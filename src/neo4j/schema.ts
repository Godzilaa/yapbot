import type { Driver } from "neo4j-driver";

export const schemaStatements = [
  "CREATE CONSTRAINT user_discord_id IF NOT EXISTS FOR (u:User) REQUIRE u.discordId IS UNIQUE",
  "CREATE CONSTRAINT team_name IF NOT EXISTS FOR (t:Team) REQUIRE t.name IS UNIQUE",
  "CREATE CONSTRAINT project_name IF NOT EXISTS FOR (p:Project) REQUIRE p.name IS UNIQUE",
  "CREATE CONSTRAINT meeting_id IF NOT EXISTS FOR (m:Meeting) REQUIRE m.id IS UNIQUE",
  "CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE",
  "CREATE CONSTRAINT decision_id IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE",
  "CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE",
  "CREATE CONSTRAINT interest_name IF NOT EXISTS FOR (i:Interest) REQUIRE i.name IS UNIQUE",
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
