import type { Driver } from "neo4j-driver";
import type { AppConfig } from "./config/env.js";
import { createNeo4jDriver } from "./neo4j/driver.js";
import { GraphRepository } from "./neo4j/graphRepository.js";
import { QueryService } from "./neo4j/queryService.js";
import { createTranscriptExtractor } from "./extraction/factory.js";
import { TranscriptIngestionService } from "./ingestion/transcriptIngestionService.js";
import { MeetingSessionManager } from "./meetings/meetingSessionManager.js";

export interface AppServices {
  driver: Driver;
  graph: GraphRepository;
  queries: QueryService;
  ingestion: TranscriptIngestionService;
  meetings: MeetingSessionManager;
}

export function createAppServices(config: AppConfig): AppServices {
  const driver = createNeo4jDriver(config);
  const graph = new GraphRepository(driver, config.NEO4J_DATABASE);
  const queries = new QueryService(driver, config.NEO4J_DATABASE);
  const extractor = createTranscriptExtractor(config);
  const ingestion = new TranscriptIngestionService(extractor, graph, config.LOW_CONFIDENCE_THRESHOLD);
  const meetings = new MeetingSessionManager();

  return { driver, graph, queries, ingestion, meetings };
}
