import type { Driver } from "neo4j-driver";
import { newId, normalizeName } from "../domain/ids.js";
import type { DecisionStatus, TaskStatus } from "../domain/extraction.js";

export type GraphTx = Parameters<Parameters<ReturnType<Driver["session"]>["executeWrite"]>[0]>[0];

export interface GraphUserInput {
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
  id: string;
  title: string;
  description: string;
  rationale?: string | null;
  status: DecisionStatus;
  confidence: number;
  sourceText?: string | null;
}

export interface RiskInput {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  sourceText?: string | null;
}

export interface TaskUpdateInput {
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
      discordId: input.discordId ?? `name:${normalizeName(input.displayName).toLowerCase()}`,
      displayName: normalizeName(input.displayName),
      role: input.role ?? null,
      now: new Date().toISOString()
    };
    await this.run(tx, `
      MERGE (u:User {discordId: $discordId})
      ON CREATE SET u.id = randomUUID(), u.createdAt = $now
      SET u.displayName = $displayName,
          u.role = coalesce($role, u.role),
          u.updatedAt = $now
    `, params);
  }

  async upsertTeam(name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (t:Team {name: $name})
      ON CREATE SET t.id = randomUUID(), t.createdAt = $now
      SET t.updatedAt = $now
    `, { name: normalizeName(name), now: new Date().toISOString() });
  }

  async linkUserTeam(userDiscordId: string, teamName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordId: $discordId})
      MATCH (t:Team {name: $teamName})
      MERGE (u)-[r:MEMBER_OF]->(t)
      ON CREATE SET r.createdAt = $now
    `, { discordId: userDiscordId, teamName: normalizeName(teamName), now: new Date().toISOString() });
  }

  async upsertInterest(name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (i:Interest {name: $name})
      ON CREATE SET i.id = randomUUID(), i.createdAt = $now
      SET i.updatedAt = $now
    `, { name: normalizeName(name).toLowerCase(), now: new Date().toISOString() });
  }

  async linkUserInterest(userDiscordId: string, interestName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordId: $discordId})
      MATCH (i:Interest {name: $interestName})
      MERGE (u)-[r:INTERESTED_IN]->(i)
      ON CREATE SET r.createdAt = $now
    `, { discordId: userDiscordId, interestName: normalizeName(interestName).toLowerCase(), now: new Date().toISOString() });
  }

  async upsertProject(name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (p:Project {name: $name})
      ON CREATE SET p.id = randomUUID(), p.status = 'active', p.createdAt = $now
      SET p.updatedAt = $now
    `, { name: normalizeName(name), now: new Date().toISOString() });
  }

  async createMeeting(input: MeetingInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (m:Meeting {id: $id})
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

  async linkMeetingProject(meetingId: string, projectName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (m:Meeting {id: $meetingId})
      MATCH (p:Project {name: $projectName})
      MERGE (m)-[r:ABOUT]->(p)
      ON CREATE SET r.createdAt = $now
    `, { meetingId, projectName: normalizeName(projectName), now: new Date().toISOString() });
  }

  async attachAttendee(meetingId: string, userDiscordId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordId: $discordId})
      MATCH (m:Meeting {id: $meetingId})
      MERGE (u)-[r:ATTENDED]->(m)
      ON CREATE SET r.createdAt = $now
    `, { discordId: userDiscordId, meetingId, now: new Date().toISOString() });
  }

  async attachMissedUser(meetingId: string, userDiscordId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (u:User {discordId: $discordId})
      MATCH (m:Meeting {id: $meetingId})
      MERGE (u)-[r:MISSED]->(m)
      ON CREATE SET r.createdAt = $now
    `, { discordId: userDiscordId, meetingId, now: new Date().toISOString() });
  }

  async upsertTopic(name: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (t:Topic {name: $name})
      ON CREATE SET t.id = randomUUID(), t.createdAt = $now
      SET t.updatedAt = $now
    `, { name: normalizeName(name), now: new Date().toISOString() });
  }

  async linkMeetingTopic(meetingId: string, topicName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (m:Meeting {id: $meetingId})
      MATCH (t:Topic {name: $topicName})
      MERGE (m)-[r:DISCUSSED]->(t)
      ON CREATE SET r.createdAt = $now
    `, { meetingId, topicName: normalizeName(topicName), now: new Date().toISOString() });
  }

  async createTask(input: TaskInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (task:Task {id: $id})
      ON CREATE SET task.createdAt = $now
      SET task.title = $title,
          task.description = $description,
          task.status = $status,
          task.priority = $priority,
          task.dueAt = CASE WHEN $dueAt IS NULL THEN null ELSE datetime($dueAt) END,
          task.confidence = $confidence,
          task.sourceText = $sourceText,
          task.updatedAt = $now
    `, { ...input, now: new Date().toISOString() });
  }

  async assignTask(taskId: string, userDiscordId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {id: $taskId})
      MATCH (u:User {discordId: $discordId})
      MERGE (task)-[r:ASSIGNED_TO]->(u)
      ON CREATE SET r.createdAt = $now
    `, { taskId, discordId: userDiscordId, now: new Date().toISOString() });
  }

  async linkTaskToProject(taskId: string, projectName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {id: $taskId})
      MATCH (p:Project {name: $projectName})
      MERGE (task)-[r:BELONGS_TO]->(p)
      ON CREATE SET r.createdAt = $now
    `, { taskId, projectName: normalizeName(projectName), now: new Date().toISOString() });
  }

  async linkTaskTopic(taskId: string, topicName: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {id: $taskId})
      MATCH (topic:Topic {name: $topicName})
      MERGE (task)-[r:RELATES_TO]->(topic)
      ON CREATE SET r.createdAt = $now
    `, { taskId, topicName: normalizeName(topicName), now: new Date().toISOString() });
  }

  async createTaskUpdate(taskId: string, input: TaskUpdateInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (task:Task {id: $taskId})
      MATCH (actor:User {discordId: $actorDiscordId})
      CREATE (update:TaskUpdate {
        id: $id,
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
      status: input.status,
      note: input.note ?? null,
      actorDiscordId: input.actorDiscordId,
      now: new Date().toISOString()
    });
  }

  async createDecision(input: DecisionInput, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MERGE (d:Decision {id: $id})
      ON CREATE SET d.createdAt = $now
      SET d.title = $title,
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
      MERGE (r:Risk {id: $id})
      ON CREATE SET r.createdAt = $now
      SET r.title = $title,
          r.description = $description,
          r.severity = $severity,
          r.confidence = $confidence,
          r.sourceText = $sourceText,
          r.updatedAt = $now
    `, { ...input, now: new Date().toISOString() });
  }

  async linkMeetingOutput(meetingId: string, outputLabel: "Task" | "Decision" | "Risk", outputId: string, tx?: GraphTx): Promise<void> {
    await this.run(tx, `
      MATCH (m:Meeting {id: $meetingId})
      MATCH (output:${outputLabel} {id: $outputId})
      MERGE (m)-[r:PRODUCED]->(output)
      ON CREATE SET r.createdAt = $now
    `, { meetingId, outputId, now: new Date().toISOString() });
  }

  async linkDecisionImpact(decisionId: string, label: "Team" | "Project" | "Task", key: string, tx?: GraphTx): Promise<void> {
    const matchProperty = label === "Task" ? "id" : "name";
    const value = label === "Task" ? key : normalizeName(key);
    await this.run(tx, `
      MATCH (d:Decision {id: $decisionId})
      MATCH (target:${label} {${matchProperty}: $value})
      MERGE (d)-[r:AFFECTS]->(target)
      ON CREATE SET r.createdAt = $now
    `, { decisionId, value, now: new Date().toISOString() });
  }

  async linkRiskImpact(riskId: string, label: "Team" | "Project" | "Task", key: string, tx?: GraphTx): Promise<void> {
    const matchProperty = label === "Task" ? "id" : "name";
    const value = label === "Task" ? key : normalizeName(key);
    await this.run(tx, `
      MATCH (risk:Risk {id: $riskId})
      MATCH (target:${label} {${matchProperty}: $value})
      MERGE (risk)-[r:AFFECTS]->(target)
      ON CREATE SET r.createdAt = $now
    `, { riskId, value, now: new Date().toISOString() });
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
