import { readFile } from "node:fs/promises";
import { createAppServices } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { JsonExtractor } from "../src/extraction/jsonExtractor.js";
import { TranscriptIngestionService } from "../src/ingestion/transcriptIngestionService.js";
import { runSchemaMigrations } from "../src/neo4j/schema.js";

const config = loadConfig();
const services = createAppServices(config);

try {
  await runSchemaMigrations(services.driver, config.NEO4J_DATABASE);
  const raw = await readFile("samples/extractions/backend-sync.json", "utf8");
  const extraction = JSON.parse(raw);
  const ingestion = new TranscriptIngestionService(
    new JsonExtractor(extraction),
    services.graph,
    config.LOW_CONFIDENCE_THRESHOLD
  );

  const result = await ingestion.ingest({
    transcript: "Sample transcript is represented by structured extraction JSON.",
    title: "Backend sync",
    startedAt: "2026-05-04T10:00:00.000Z",
    endedAt: "2026-05-04T10:45:00.000Z",
    discordGuildId: "sample-guild",
    discordChannelId: "sample-channel",
    project: "AI Project Manager Bot",
    transcriptRef: "samples/transcripts/backend-sync.txt"
  });

  console.log(result);
} finally {
  await services.driver.close();
}
