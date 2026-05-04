import type { Driver, Record as Neo4jRecord } from "neo4j-driver";

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt?: string | null;
}

export interface DecisionSummary {
  id: string;
  title: string;
  description: string;
  createdAt?: string | null;
}

export interface MeetingSummary {
  id: string;
  title: string;
  startedAt?: string | null;
  summary?: string | null;
}

export class QueryService {
  constructor(
    private readonly driver: Driver,
    private readonly database: string
  ) {}

  async getTasksForUser(discordGuildId: string, discordId: string): Promise<TaskSummary[]> {
    return this.read(`
      MATCH (task:Task)-[:ASSIGNED_TO]->(user:User)
      WHERE user.discordGuildId = $discordGuildId
        AND task.discordGuildId = $discordGuildId
        AND user.discordId = $discordId
        AND task.status <> 'done'
      RETURN task
      ORDER BY task.dueAt ASC
    `, { discordGuildId, discordId }, (record) => mapTask(record.get("task").properties));
  }

  async getTasksByDisplayName(discordGuildId: string, name: string): Promise<TaskSummary[]> {
    return this.read(`
      MATCH (task:Task)-[:ASSIGNED_TO]->(user:User)
      WHERE user.discordGuildId = $discordGuildId
        AND task.discordGuildId = $discordGuildId
        AND toLower(user.displayName) = toLower($name)
        AND task.status <> 'done'
      RETURN task
      ORDER BY task.dueAt ASC
    `, { discordGuildId, name }, (record) => mapTask(record.get("task").properties));
  }

  async getDecisionsForTeam(discordGuildId: string, teamName: string): Promise<DecisionSummary[]> {
    return this.read(`
      MATCH (decision:Decision)-[:AFFECTS]->(team:Team)
      WHERE decision.discordGuildId = $discordGuildId
        AND team.discordGuildId = $discordGuildId
        AND toLower(team.name) = toLower($teamName)
      RETURN decision
      ORDER BY decision.createdAt DESC
    `, { discordGuildId, teamName }, (record) => mapDecision(record.get("decision").properties));
  }

  async getMissedMeetings(discordGuildId: string, discordId: string, start: string, end: string): Promise<MeetingSummary[]> {
    return this.read(`
      MATCH (user:User {discordGuildId: $discordGuildId, discordId: $discordId})
      MATCH (meeting:Meeting)
      WHERE meeting.startedAt >= datetime($start)
        AND meeting.startedAt < datetime($end)
        AND meeting.discordGuildId = $discordGuildId
        AND NOT (user)-[:ATTENDED]->(meeting)
      RETURN meeting
      ORDER BY meeting.startedAt ASC
    `, { discordGuildId, discordId, start, end }, (record) => mapMeeting(record.get("meeting").properties));
  }

  async getOpenBlockers(discordGuildId: string): Promise<Array<{ blocked: TaskSummary; blocker: TaskSummary }>> {
    return this.read(`
      MATCH (blocked:Task)-[:BLOCKED_BY]->(blocker:Task)
      WHERE blocked.discordGuildId = $discordGuildId
        AND blocker.discordGuildId = $discordGuildId
        AND blocked.status <> 'done'
      RETURN blocked, blocker
      ORDER BY blocked.dueAt ASC
    `, { discordGuildId }, (record) => ({
      blocked: mapTask(record.get("blocked").properties),
      blocker: mapTask(record.get("blocker").properties)
    }));
  }

  private async read<T>(
    cypher: string,
    params: Record<string, unknown>,
    map: (record: Neo4jRecord) => T
  ): Promise<T[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.executeRead((tx) => tx.run(cypher, params));
      return result.records.map(map);
    } finally {
      await session.close();
    }
  }
}

function mapTask(props: Record<string, unknown>): TaskSummary {
  return {
    id: String(props.id),
    title: String(props.title),
    status: String(props.status),
    priority: String(props.priority),
    dueAt: stringifyTemporal(props.dueAt)
  };
}

function mapDecision(props: Record<string, unknown>): DecisionSummary {
  return {
    id: String(props.id),
    title: String(props.title),
    description: String(props.description ?? ""),
    createdAt: stringifyTemporal(props.createdAt)
  };
}

function mapMeeting(props: Record<string, unknown>): MeetingSummary {
  return {
    id: String(props.id),
    title: String(props.title),
    startedAt: stringifyTemporal(props.startedAt),
    summary: props.summary ? String(props.summary) : null
  };
}

function stringifyTemporal(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}
