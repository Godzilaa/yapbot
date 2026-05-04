import type { Driver } from "neo4j-driver";
import type { AppConfig } from "./config/env.js";
import { createNeo4jDriver } from "./neo4j/driver.js";
import { GraphRepository } from "./neo4j/graphRepository.js";
import { QueryService } from "./neo4j/queryService.js";
import { LlmExtractorStub } from "./extraction/llmExtractor.stub.js";
import { TranscriptIngestionService } from "./ingestion/transcriptIngestionService.js";

export interface AppServices {
  driver: Driver;
  graph: GraphRepository;
  queries: QueryService;
  ingestion: TranscriptIngestionService;
}

export function createAppServices(config: AppConfig): AppServices {
  const driver = createNeo4jDriver(config);
  const graph = new GraphRepository(driver, config.NEO4J_DATABASE);
  const queries = new QueryService(driver, config.NEO4J_DATABASE);
  const extractor = new LlmExtractorStub();
  const ingestion = new TranscriptIngestionService(extractor, graph, config.LOW_CONFIDENCE_THRESHOLD);

  return { driver, graph, queries, ingestion };
}
