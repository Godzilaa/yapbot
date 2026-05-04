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
        await this.graph.upsertProject(input.discordGuildId, extraction.meeting.project, tx);
        await this.graph.linkMeetingProject(input.discordGuildId, meetingId, extraction.meeting.project, tx);
      }

      await this.writeUsersAndAttendance(input.discordGuildId, meetingId, extraction, tx);
      await this.writeTopics(input.discordGuildId, meetingId, extraction, tx);
      await this.writeTasks(input.discordGuildId, meetingId, extraction, tx);
      await this.writeDecisions(input.discordGuildId, meetingId, extraction, tx);
      await this.writeRisks(input.discordGuildId, meetingId, extraction, tx);
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

  private async writeUsersAndAttendance(
    discordGuildId: string,
    meetingId: string,
    extraction: Extraction,
    tx: GraphTx
  ): Promise<void> {
    for (const attendee of extraction.attendees) {
      await this.writeUserContext(discordGuildId, attendee, tx);
      await this.graph.attachAttendee(discordGuildId, meetingId, userKey(attendee), tx);
    }

    for (const missedUser of extraction.missedUsers) {
      await this.writeUserContext(discordGuildId, missedUser, tx);
      await this.graph.attachMissedUser(discordGuildId, meetingId, userKey(missedUser), tx);
    }
  }

  private async writeUserContext(discordGuildId: string, user: ExtractedUser, tx: GraphTx): Promise<void> {
    await this.graph.upsertUser({
      discordGuildId,
      discordId: user.discordId,
      displayName: user.displayName,
      role: user.role ?? undefined
    }, tx);

    const team = user.team ?? undefined;
    if (team) {
      await this.graph.upsertTeam(discordGuildId, team, tx);
      await this.graph.linkUserTeam(discordGuildId, userKey(user), team, tx);
    }

    for (const interest of user.interests ?? []) {
      await this.graph.upsertInterest(discordGuildId, interest, tx);
      await this.graph.linkUserInterest(discordGuildId, userKey(user), interest, tx);
    }
  }

  private async writeTopics(discordGuildId: string, meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const topic of extraction.topics) {
      await this.graph.upsertTopic(discordGuildId, topic.name, tx);
      await this.graph.linkMeetingTopic(discordGuildId, meetingId, topic.name, tx);
    }
  }

  private async writeTasks(discordGuildId: string, meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const task of extraction.tasks) {
      const taskId = stableId("task", [meetingId, task.title, task.sourceText]);
      await this.graph.createTask({
        discordGuildId,
        id: taskId,
        title: normalizeName(task.title),
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        confidence: task.confidence,
        sourceText: task.sourceText ?? null
      }, tx);
      await this.graph.linkMeetingOutput(discordGuildId, meetingId, "Task", taskId, tx);

      if (task.assignee) {
        await this.graph.upsertUser({
          discordGuildId,
          discordId: task.assignee.discordId,
          displayName: task.assignee.displayName
        }, tx);
        await this.graph.assignTask(discordGuildId, taskId, userKey(task.assignee), tx);
      }

      if (task.project) {
        await this.graph.upsertProject(discordGuildId, task.project, tx);
        await this.graph.linkTaskToProject(discordGuildId, taskId, task.project, tx);
      }

      if (task.topic) {
        await this.graph.upsertTopic(discordGuildId, task.topic, tx);
        await this.graph.linkTaskTopic(discordGuildId, taskId, task.topic, tx);
      }
    }
  }

  private async writeDecisions(discordGuildId: string, meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const decision of extraction.decisions) {
      const decisionId = stableId("decision", [meetingId, decision.title, decision.sourceText]);
      await this.graph.createDecision({
        discordGuildId,
        id: decisionId,
        title: normalizeName(decision.title),
        description: decision.description,
        rationale: decision.rationale,
        status: decision.status,
        confidence: decision.confidence,
        sourceText: decision.sourceText ?? null
      }, tx);
      await this.graph.linkMeetingOutput(discordGuildId, meetingId, "Decision", decisionId, tx);

      for (const team of decision.affects.teams) {
        await this.graph.upsertTeam(discordGuildId, team, tx);
        await this.graph.linkDecisionImpact(discordGuildId, decisionId, "Team", team, tx);
      }

      for (const project of decision.affects.projects) {
        await this.graph.upsertProject(discordGuildId, project, tx);
        await this.graph.linkDecisionImpact(discordGuildId, decisionId, "Project", project, tx);
      }
    }
  }

  private async writeRisks(discordGuildId: string, meetingId: string, extraction: Extraction, tx: GraphTx): Promise<void> {
    for (const risk of extraction.risks) {
      const riskId = stableId("risk", [meetingId, risk.title, risk.sourceText]);
      await this.graph.createRisk({
        discordGuildId,
        id: riskId,
        title: normalizeName(risk.title),
        description: risk.description,
        severity: risk.severity,
        confidence: risk.confidence,
        sourceText: risk.sourceText ?? null
      }, tx);
      await this.graph.linkMeetingOutput(discordGuildId, meetingId, "Risk", riskId, tx);

      for (const team of risk.affects.teams) {
        await this.graph.upsertTeam(discordGuildId, team, tx);
        await this.graph.linkRiskImpact(discordGuildId, riskId, "Team", team, tx);
      }

      for (const project of risk.affects.projects) {
        await this.graph.upsertProject(discordGuildId, project, tx);
        await this.graph.linkRiskImpact(discordGuildId, riskId, "Project", project, tx);
      }
    }
  }
}

function userKey(user: { discordId?: string; displayName: string }): string {
  return user.discordId ?? `name:${normalizeName(user.displayName).toLowerCase()}`;
}
