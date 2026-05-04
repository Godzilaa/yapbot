import neo4j, { type Driver } from "neo4j-driver";
import type { AppConfig } from "../config/env.js";

export function createNeo4jDriver(config: AppConfig): Driver {
  return neo4j.driver(
    config.NEO4J_URI,
    neo4j.auth.basic(config.NEO4J_USERNAME, config.NEO4J_PASSWORD)
  );
}
