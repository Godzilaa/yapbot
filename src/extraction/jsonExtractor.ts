import { validateExtraction, type Extraction } from "../domain/extraction.js";
import type { TranscriptExtractor, TranscriptInput } from "./extractor.js";

export class JsonExtractor implements TranscriptExtractor {
  constructor(private readonly extractionJson: unknown) {}

  async extract(_input: TranscriptInput): Promise<Extraction> {
    return validateExtraction(this.extractionJson);
  }
}
