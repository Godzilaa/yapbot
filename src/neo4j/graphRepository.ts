import type { Driver } from "neo4j-driver";
import { newId, normalizeName } from "../domain/ids.js";
import type { DecisionStatus, TaskStatus } from "../domain/extraction.js";

export type GraphTx = Parameters<Parameters<ReturnType<Driver["session"]>["executeWrite"]>[0]>[0];

export interface GraphUserInput {
  discordGuildId: string;
  discordId?: string;
  displayName: string;
  role?: string;
}

export interface MeetingInput {
  id: string;
  discordGuildId: string;
  discordChannelId: string;
  title: string;
  startedAt: string;
  endedAt?: string | null;
  transcriptRef?: string | null;
  summary?: string | null;
}

export interface TaskInput {
  discordGuildId: string;
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt?: string | null;
  confidence: number;
  sourceText?: string | null;
}

export interface DecisionInput {
  discordGuildId: string;
  id: string;
  title: string;
  description: string;
  rationale?: string | null;
  status: DecisionStatus;
  confidence: number;
  sourceText?: string | null;
}

export interface RiskInput {
  discordGuildId: string;
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  sourceText?: string | null;
}

export interface TaskUpdateInput {
  discordGuildId: string;
  id?: string;
  status: TaskStatus;
  note?: string;
  actorDiscordId: string;
}

export class GraphRepository {
  constructor(
    private readonly driver: Driver,
    private readonly database: string
  ) {}

  async executeWrite<T>(work: (tx: GraphTx) => Promise<T>): Promise<T> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.executeWrite(work);
    } finally {
      await session.close();
    }
  }

  async executeRead<T>(work: (tx: GraphTx) => Promise<T>): Promise<T> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.executeRead(work);
    } finally {
      await session.close();
    }
  }

  async upsertUser(input: GraphUserInput, tx?: GraphTx): Promise<void> {
    const params = {
      discordGuildId: input.discordGuildId,
      discordId: input.discordId ?? `name:${normalizeName(input.displayName).toLowerCase()}`,
      displayName: normalizeName(input.displayName),
      role: input.role ?? null,
      now: new Date().toISOString()
    };
    await this.run(tx, `
      MERGE (u:User {discordGuildId: $discordGuildId, discordId: $discordId})
      ON CREATE SET u.id = randomUUID(), u.createdAt = $now
      SET u.discordGuildId = $discordGuildId,
          u.displayName = $displayName,
          u.role = coalesce($role, u.role),
          u.updatedAt = $now
    `, params);
  }

  async upsertTeam(discordGuildId: string, name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (t:Team {discordGuildId: $discordGuildId, name: $name})
      ON CREATE SET t.id = randomUUID(), t.createdAt = $now
      SET t.discordGuildId = $discordGuildId,
          t.updatedAt = $now
    `, { discordGuildId, name: normalizeName(name), now: new Date().toISOString() });
  }

  async linkUserTeam(discordGuildId: string, userDiscordId: string, teamName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordGuildId: $discordGuildId, discordId: $discordId})
      MATCH (t:Team {discordGuildId: $discordGuildId, name: $teamName})
      MERGE (u)-[r:MEMBER_OF]->(t)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, discordId: userDiscordId, teamName: normalizeName(teamName), now: new Date().toISOString() });
  }

  async upsertInterest(discordGuildId: string, name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (i:Interest {discordGuildId: $discordGuildId, name: $name})
      ON CREATE SET i.id = randomUUID(), i.createdAt = $now
      SET i.discordGuildId = $discordGuildId,
          i.updatedAt = $now
    `, { discordGuildId, name: normalizeName(name).toLowerCase(), now: new Date().toISOString() });
  }

  async linkUserInterest(discordGuildId: string, userDiscordId: string, interestName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordGuildId: $discordGuildId, discordId: $discordId})
      MATCH (i:Interest {discordGuildId: $discordGuildId, name: $interestName})
      MERGE (u)-[r:INTERESTED_IN]->(i)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, discordId: userDiscordId, interestName: normalizeName(interestName).toLowerCase(), now: new Date().toISOString() });
  }

  async upsertProject(discordGuildId: string, name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (p:Project {discordGuildId: $discordGuildId, name: $name})
      ON CREATE SET p.id = randomUUID(), p.status = 'active', p.createdAt = $now
      SET p.discordGuildId = $discordGuildId,
          p.updatedAt = $now
    `, { discordGuildId, name: normalizeName(name), now: new Date().toISOString() });
  }

  async createMeeting(input: MeetingInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (m:Meeting {discordGuildId: $discordGuildId, id: $id})
      ON CREATE SET m.createdAt = $now
      SET m.discordGuildId = $discordGuildId,
          m.discordChannelId = $discordChannelId,
          m.title = $title,
          m.startedAt = datetime($startedAt),
          m.endedAt = CASE WHEN $endedAt IS NULL THEN null ELSE datetime($endedAt) END,
          m.transcriptRef = $transcriptRef,
          m.summary = $summary,
          m.updatedAt = $now
    `, { ...input, now: new Date().toISOString() });
  }

  async linkMeetingProject(discordGuildId: string, meetingId: string, projectName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (m:Meeting {discordGuildId: $discordGuildId, id: $meetingId})
      MATCH (p:Project {discordGuildId: $discordGuildId, name: $projectName})
      MERGE (m)-[r:ABOUT]->(p)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, meetingId, projectName: normalizeName(projectName), now: new Date().toISOString() });
  }

  async attachAttendee(discordGuildId: string, meetingId: string, userDiscordId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordGuildId: $discordGuildId, discordId: $discordId})
      MATCH (m:Meeting {discordGuildId: $discordGuildId, id: $meetingId})
      MERGE (u)-[r:ATTENDED]->(m)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, discordId: userDiscordId, meetingId, now: new Date().toISOString() });
  }

  async attachMissedUser(discordGuildId: string, meetingId: string, userDiscordId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordGuildId: $discordGuildId, discordId: $discordId})
      MATCH (m:Meeting {discordGuildId: $discordGuildId, id: $meetingId})
      MERGE (u)-[r:MISSED]->(m)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, discordId: userDiscordId, meetingId, now: new Date().toISOString() });
  }

  async upsertTopic(discordGuildId: string, name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (t:Topic {discordGuildId: $discordGuildId, name: $name})
      ON CREATE SET t.id = randomUUID(), t.createdAt = $now
      SET t.discordGuildId = $discordGuildId,
          t.updatedAt = $now
    `, { discordGuildId, name: normalizeName(name), now: new Date().toISOString() });
  }

  async linkMeetingTopic(discordGuildId: string, meetingId: string, topicName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (m:Meeting {discordGuildId: $discordGuildId, id: $meetingId})
      MATCH (t:Topic {discordGuildId: $discordGuildId, name: $topicName})
      MERGE (m)-[r:DISCUSSED]->(t)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, meetingId, topicName: normalizeName(topicName), now: new Date().toISOString() });
  }

  async createTask(input: TaskInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (task:Task {discordGuildId: $discordGuildId, id: $id})
      ON CREATE SET task.createdAt = $now
      SET task.discordGuildId = $discordGuildId,
          task.title = $title,
          task.description = $description,
          task.status = $status,
          task.priority = $priority,
          task.dueAt = CASE WHEN $dueAt IS NULL THEN null ELSE datetime($dueAt) END,
          task.confidence = $confidence,
          task.sourceText = $sourceText,
          task.updatedAt = $now
    `, { ...input, now: new Date().toISOString() });
  }

  async assignTask(discordGuildId: string, taskId: string, userDiscordId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {discordGuildId: $discordGuildId, id: $taskId})
      MATCH (u:User {discordGuildId: $discordGuildId, discordId: $discordId})
      MERGE (task)-[r:ASSIGNED_TO]->(u)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, taskId, discordId: userDiscordId, now: new Date().toISOString() });
  }

  async linkTaskToProject(discordGuildId: string, taskId: string, projectName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {discordGuildId: $discordGuildId, id: $taskId})
      MATCH (p:Project {discordGuildId: $discordGuildId, name: $projectName})
      MERGE (task)-[r:BELONGS_TO]->(p)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, taskId, projectName: normalizeName(projectName), now: new Date().toISOString() });
  }

  async linkTaskTopic(discordGuildId: string, taskId: string, topicName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {discordGuildId: $discordGuildId, id: $taskId})
      MATCH (topic:Topic {discordGuildId: $discordGuildId, name: $topicName})
      MERGE (task)-[r:RELATES_TO]->(topic)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, taskId, topicName: normalizeName(topicName), now: new Date().toISOString() });
  }

  async createTaskUpdate(taskId: string, input: TaskUpdateInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {discordGuildId: $discordGuildId, id: $taskId})
      MATCH (actor:User {discordGuildId: $discordGuildId, discordId: $actorDiscordId})
      CREATE (update:TaskUpdate {
        id: $id,
        discordGuildId: $discordGuildId,
        status: $status,
        note: $note,
        createdAt: $now
      })
      MERGE (task)-[:HAS_UPDATE]->(update)
      MERGE (update)-[:MADE_BY]->(actor)
      SET task.status = $status, task.updatedAt = $now
    `, {
      taskId,
      id: input.id ?? newId("update"),
      discordGuildId: input.discordGuildId,
      status: input.status,
      note: input.note ?? null,
      actorDiscordId: input.actorDiscordId,
      now: new Date().toISOString()
    });
  }

  async createDecision(input: DecisionInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (d:Decision {discordGuildId: $discordGuildId, id: $id})
      ON CREATE SET d.createdAt = $now
      SET d.discordGuildId = $discordGuildId,
          d.title = $title,
          d.description = $description,
          d.rationale = $rationale,
          d.status = $status,
          d.confidence = $confidence,
          d.sourceText = $sourceText,
          d.updatedAt = $now
    `, { ...input, now: new Date().toISOString() });
  }

  async createRisk(input: RiskInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (r:Risk {discordGuildId: $discordGuildId, id: $id})
      ON CREATE SET r.createdAt = $now
      SET r.discordGuildId = $discordGuildId,
          r.title = $title,
          r.description = $description,
          r.severity = $severity,
          r.confidence = $confidence,
          r.sourceText = $sourceText,
          r.updatedAt = $now
    `, { ...input, now: new Date().toISOString() });
  }

  async linkMeetingOutput(discordGuildId: string, meetingId: string, outputLabel: "Task" | "Decision" | "Risk", outputId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (m:Meeting {discordGuildId: $discordGuildId, id: $meetingId})
      MATCH (output:${outputLabel} {discordGuildId: $discordGuildId, id: $outputId})
      MERGE (m)-[r:PRODUCED]->(output)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, meetingId, outputId, now: new Date().toISOString() });
  }

  async linkDecisionImpact(discordGuildId: string, decisionId: string, label: "Team" | "Project" | "Task", key: string, tx?: GraphTx): Promise<void> {
    const matchProperty = label === "Task" ? "id" : "name";
    const value = label === "Task" ? key : normalizeName(key);
    await this.run(tx, `
      MATCH (d:Decision {discordGuildId: $discordGuildId, id: $decisionId})
      MATCH (target:${label} {discordGuildId: $discordGuildId, ${matchProperty}: $value})
      MERGE (d)-[r:AFFECTS]->(target)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, decisionId, value, now: new Date().toISOString() });
  }

  async linkRiskImpact(discordGuildId: string, riskId: string, label: "Team" | "Project" | "Task", key: string, tx?: GraphTx): Promise<void> {
    const matchProperty = label === "Task" ? "id" : "name";
    const value = label === "Task" ? key : normalizeName(key);
    await this.run(tx, `
      MATCH (risk:Risk {discordGuildId: $discordGuildId, id: $riskId})
      MATCH (target:${label} {discordGuildId: $discordGuildId, ${matchProperty}: $value})
      MERGE (risk)-[r:AFFECTS]->(target)
      ON CREATE SET r.createdAt = $now
    `, { discordGuildId, riskId, value, now: new Date().toISOString() });
  }

  private async run(tx: GraphTx | undefined, cypher: string, params: Record<string, unknown>): Promise<void> {
    if (tx) {
      await tx.run(cypher, params);
      return;
    }

    await this.executeWrite(async (writeTx) => {
      await writeTx.run(cypher, params);
    });
  }
}
