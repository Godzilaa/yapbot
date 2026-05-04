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
        summary: "LLM extraction is not wired yet. Replace LlmExtractorStub with a provider-backed extractor."
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
