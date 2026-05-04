import { requireLlmConfig, type AppConfig } from "../config/env.js";
import { validateExtraction, type Extraction } from "../domain/extraction.js";
import type { TranscriptExtractor, TranscriptInput } from "./extractor.js";
import { buildExtractionSystemPrompt, buildExtractionUserPrompt } from "./llmPrompt.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export class OpenAiCompatibleExtractor implements TranscriptExtractor {
  constructor(private readonly config: AppConfig) {
    requireLlmConfig(config);
  }

  async extract(input: TranscriptInput): Promise<Extraction> {
    requireLlmConfig(this.config);
    const runtime = resolveRuntimeConfig(this.config);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runtime.apiKey}`
        },
        body: JSON.stringify({
          model: runtime.model,
          temperature: this.config.LLM_TEMPERATURE,
          ...(runtime.reasoningEffort ? { reasoning_effort: runtime.reasoningEffort } : {}),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildExtractionSystemPrompt() },
            { role: "user", content: buildExtractionUserPrompt(input) }
          ]
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`LLM extraction failed: ${response.status} ${body}`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("LLM extraction failed: response did not include message content.");
      }

      return validateExtraction(parseJsonObject(content));
    } finally {
      clearTimeout(timeout);
    }
  }
}

function resolveRuntimeConfig(config: AppConfig): {
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort?: "low" | "medium" | "high";
} {
  if (config.LLM_PROVIDER === "groq") {
    const baseUrl =
      config.LLM_API_BASE_URL === "https://api.openai.com/v1"
        ? "https://api.groq.com/openai/v1"
        : config.LLM_API_BASE_URL;
    const apiKey = config.GROQ_API_KEY ?? config.LLM_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY for Groq extractor.");
    }

    return {
      baseUrl,
      apiKey,
      model: config.GROQ_MODEL,
      reasoningEffort: config.GROQ_REASONING_EFFORT
    };
  }

  if (!config.LLM_API_KEY || !config.LLM_MODEL) {
    throw new Error("Missing LLM_API_KEY or LLM_MODEL for openai-compatible extractor.");
  }

  return {
    baseUrl: config.LLM_API_BASE_URL,
    apiKey: config.LLM_API_KEY,
    model: config.LLM_MODEL
  };
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("LLM extraction response was not valid JSON.");
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
