import type { Driver } from "neo4j-driver";

export const schemaStatements = [
  "DROP CONSTRAINT user_discord_id IF EXISTS",
  "DROP CONSTRAINT team_name IF EXISTS",
  "DROP CONSTRAINT project_name IF EXISTS",
  "DROP CONSTRAINT meeting_id IF EXISTS",
  "DROP CONSTRAINT task_id IF EXISTS",
  "DROP CONSTRAINT decision_id IF EXISTS",
  "DROP CONSTRAINT topic_name IF EXISTS",
  "DROP CONSTRAINT interest_name IF EXISTS",
  "CREATE CONSTRAINT user_guild_discord_id IF NOT EXISTS FOR (u:User) REQUIRE (u.discordGuildId, u.discordId) IS UNIQUE",
  "CREATE CONSTRAINT team_guild_name IF NOT EXISTS FOR (t:Team) REQUIRE (t.discordGuildId, t.name) IS UNIQUE",
  "CREATE CONSTRAINT project_guild_name IF NOT EXISTS FOR (p:Project) REQUIRE (p.discordGuildId, p.name) IS UNIQUE",
  "CREATE CONSTRAINT meeting_guild_id IF NOT EXISTS FOR (m:Meeting) REQUIRE (m.discordGuildId, m.id) IS UNIQUE",
  "CREATE CONSTRAINT task_guild_id IF NOT EXISTS FOR (t:Task) REQUIRE (t.discordGuildId, t.id) IS UNIQUE",
  "CREATE CONSTRAINT decision_guild_id IF NOT EXISTS FOR (d:Decision) REQUIRE (d.discordGuildId, d.id) IS UNIQUE",
  "CREATE CONSTRAINT topic_guild_name IF NOT EXISTS FOR (t:Topic) REQUIRE (t.discordGuildId, t.name) IS UNIQUE",
  "CREATE CONSTRAINT interest_guild_name IF NOT EXISTS FOR (i:Interest) REQUIRE (i.discordGuildId, i.name) IS UNIQUE",
  "CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status)",
  "CREATE INDEX task_due_at IF NOT EXISTS FOR (t:Task) ON (t.dueAt)",
  "CREATE INDEX meeting_started_at IF NOT EXISTS FOR (m:Meeting) ON (m.startedAt)",
  "CREATE INDEX task_update_created_at IF NOT EXISTS FOR (u:TaskUpdate) ON (u.createdAt)"
];

export async function runSchemaMigrations(driver: Driver, database: string): Promise<void> {
  const session = driver.session({ database });
  try {
    for (const statement of schemaStatements) {
      await session.run(statement);
    }
  } finally {
    await session.close();
  }
}
