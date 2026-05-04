import { loadConfig } from "../src/config/env.js";
import { createNeo4jDriver } from "../src/neo4j/driver.js";
import { runSchemaMigrations } from "../src/neo4j/schema.js";

const config = loadConfig();
const driver = createNeo4jDriver(config);

try {
  await runSchemaMigrations(driver, config.NEO4J_DATABASE);
  console.log("Neo4j schema migrations completed.");
} finally {
  await driver.close();
}
