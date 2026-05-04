import type { AppConfig } from "../config/env.js";
import type { TranscriptExtractor } from "./extractor.js";
import { LlmExtractorStub } from "./llmExtractor.stub.js";
import { OpenAiCompatibleExtractor } from "./openAiCompatibleExtractor.js";

export function createTranscriptExtractor(config: AppConfig): TranscriptExtractor {
  if (config.LLM_PROVIDER === "openai-compatible") {
    return new OpenAiCompatibleExtractor(config);
  }

  return new LlmExtractorStub();
}
