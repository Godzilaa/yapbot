import { applyConfidenceReview, type Extraction, type ExtractedUser } from "../domain/extraction.js";
import { newId, normalizeName, stableId } from "../domain/ids.js";
import type { GraphRepository, GraphTx } from "../neo4j/graphRepository.js";
import type { TranscriptExtractor, TranscriptInput } from "../extraction/extractor.js";

export interface IngestionResult {
  meetingId: string;
  taskCount: number;
  decisionCount: number;
  riskCount: number;
  pendingReviewCount: number;
}

export class TranscriptIngestionService {
  constructor(
    private readonly extractor: TranscriptExtractor,
    private readonly graph: GraphRepository,
    private readonly lowConfidenceThreshold: number
  ) {}

  async ingest(input: TranscriptInput): Promise<IngestionResult> {
    const rawExtraction = await this.extractor.extract(input);
    const extraction = applyConfidenceReview(rawExtraction, this.lowConfidenceThreshold);
    const meetingId = extraction.meeting.id ?? newId("meeting");

    await this.graph.executeWrite(async (tx) => {
      await this.graph.createMeeting({
        id: meetingId,
        discordGuildId: input.discordGuildId,
        discordChannelId: input.discordChannelId,
        title: extraction.meeting.title,
        startedAt: extraction.meeting.startedAt,
        endedAt: extraction.meeting.endedAt,
        transcriptRef: extraction.meeting.transcriptRef ?? input.transcriptRef ?? null,
        summary: extraction.meeting.summary ?? null
      }, tx);

      if (extraction.meeting.project) {
        await this.graph.upsertProject(extraction.meeting.project, tx);
        await this.graph.linkMeetingProject(meetingId, extraction.meeting.project, tx);
      }

      await this.writeUsersAndAttendance(meetingId, extraction, tx);
      await this.writeTopics(meetingId, extraction, tx);
      await this.writeTasks(meetingId, extraction, tx);
      await this.writeDecisions(meetingId, extraction, tx);
      await this.writeRisks(meetingId, extraction, tx);
    });

    return {
      meetingId,
      taskCount: extraction.tasks.length,
      decisionCount: extraction.decisions.length,
      riskCount: extraction.risks.length,
      pendingReviewCount: [
        ...extraction.tasks.map((task) => task.status),
        ...extraction.decisions.map((decision) => decision.status)
      ].filter((status) => status === "pending_review").length
    };
  }

  private async writeUsersAndAttendance(meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const attendee of extraction.attendees) {
      await this.writeUserContext(attendee, tx);
      await this.graph.attachAttendee(meetingId, userKey(attendee), tx);
    }

    for (const missedUser of extraction.missedUsers) {
      await this.writeUserContext(missedUser, tx);
      await this.graph.attachMissedUser(meetingId, userKey(missedUser), tx);
    }
  }

  private async writeUserContext(user: ExtractedUser, tx: GraphTx): Promise<void> {
    await this.graph.upsertUser({
      discordId: user.discordId,
      displayName: user.displayName,
      role: user.role
    }, tx);

    if (user.team) {
      await this.graph.upsertTeam(user.team, tx);
      await this.graph.linkUserTeam(userKey(user), user.team, tx);
    }

    for (const interest of user.interests) {
      await this.graph.upsertInterest(interest, tx);
      await this.graph.linkUserInterest(userKey(user), interest, tx);
    }
  }

  private async writeTopics(meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const topic of extraction.topics) {
      await this.graph.upsertTopic(topic.name, tx);
      await this.graph.linkMeetingTopic(meetingId, topic.name, tx);
    }
  }

  private async writeTasks(meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const task of extraction.tasks) {
      const taskId = stableId("task", [meetingId, task.title, task.sourceText]);
      await this.graph.createTask({
        id: taskId,
        title: normalizeName(task.title),
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        confidence: task.confidence,
        sourceText: task.sourceText ?? null
      }, tx);
      await this.graph.linkMeetingOutput(meetingId, "Task", taskId, tx);

      if (task.assignee) {
        await this.graph.upsertUser({
          discordId: task.assignee.discordId,
          displayName: task.assignee.displayName
        }, tx);
        await this.graph.assignTask(taskId, userKey(task.assignee), tx);
      }

      if (task.project) {
        await this.graph.upsertProject(task.project, tx);
        await this.graph.linkTaskToProject(taskId, task.project, tx);
      }

      if (task.topic) {
        await this.graph.upsertTopic(task.topic, tx);
        await this.graph.linkTaskTopic(taskId, task.topic, tx);
      }
    }
  }

  private async writeDecisions(meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const decision of extraction.decisions) {
      const decisionId = stableId("decision", [meetingId, decision.title, decision.sourceText]);
      await this.graph.createDecision({
        id: decisionId,
        title: normalizeName(decision.title),
        description: decision.description,
        rationale: decision.rationale,
        status: decision.status,
        confidence: decision.confidence,
        sourceText: decision.sourceText ?? null
      }, tx);
      await this.graph.linkMeetingOutput(meetingId, "Decision", decisionId, tx);

      for (const team of decision.affects.teams) {
        await this.graph.upsertTeam(team, tx);
        await this.graph.linkDecisionImpact(decisionId, "Team", team, tx);
      }

      for (const project of decision.affects.projects) {
        await this.graph.upsertProject(project, tx);
        await this.graph.linkDecisionImpact(decisionId, "Project", project, tx);
      }
    }
  }

  private async writeRisks(meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const risk of extraction.risks) {
      const riskId = stableId("risk", [meetingId, risk.title, risk.sourceText]);
      await this.graph.createRisk({
        id: riskId,
        title: normalizeName(risk.title),
        description: risk.description,
        severity: risk.severity,
        confidence: risk.confidence,
        sourceText: risk.sourceText ?? null
      }, tx);
      await this.graph.linkMeetingOutput(meetingId, "Risk", riskId, tx);

      for (const team of risk.affects.teams) {
        await this.graph.upsertTeam(team, tx);
        await this.graph.linkRiskImpact(riskId, "Team", team, tx);
      }

      for (const project of risk.affects.projects) {
        await this.graph.upsertProject(project, tx);
        await this.graph.linkRiskImpact(riskId, "Project", project, tx);
      }
    }
  }
}

function userKey(user: { discordId?: string; displayName: string }): string {
  return user.discordId ?? `name:${normalizeName(user.displayName).toLowerCase()}`;
}
