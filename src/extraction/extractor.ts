import type { Extraction } from "../domain/extraction.js";

export interface TranscriptInput {
  transcript: string;
  title: string;
  startedAt: string;
  endedAt?: string | null;
  discordGuildId: string;
  discordChannelId: string;
  project?: string | null;
  transcriptRef?: string | null;
}

export interface TranscriptExtractor {
  extract(input: TranscriptInput): Promise<Extraction>;
}
