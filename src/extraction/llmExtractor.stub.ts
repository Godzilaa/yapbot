import type { Extraction } from "../domain/extraction.js";
import type { TranscriptExtractor, TranscriptInput } from "./extractor.js";

export class LlmExtractorStub implements TranscriptExtractor {
  async extract(input: TranscriptInput): Promise<Extraction> {
    return {
      meeting: {
        title: input.title,
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? null,
        project: input.project ?? null,
        transcriptRef: input.transcriptRef ?? null,
        summary: "Stub extraction is enabled. Set LLM_PROVIDER=openai-compatible to use the real LLM extraction layer."
      },
      attendees: [],
      missedUsers: [],
      topics: [],
      tasks: [],
      decisions: [],
      risks: []
    };
  }
}
