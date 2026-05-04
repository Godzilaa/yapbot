import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  NEO4J_URI: z.string().default("bolt://localhost:7687"),
  NEO4J_USERNAME: z.string().default("neo4j"),
  NEO4J_PASSWORD: z.string().default("local-password"),
  NEO4J_DATABASE: z.string().default("neo4j"),
  TRANSCRIPT_STORAGE_PATH: z.string().default("./transcripts"),
  LOW_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  LLM_PROVIDER: z.enum(["stub", "openai-compatible"]).default("stub"),
  LLM_API_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}

export function requireDiscordConfig(config: AppConfig): asserts config is AppConfig & {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
} {
  if (!config.DISCORD_TOKEN || !config.DISCORD_CLIENT_ID) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required for Discord commands.");
  }
}

export function requireLlmConfig(config: AppConfig): asserts config is AppConfig & {
  LLM_API_KEY: string;
  LLM_MODEL: string;
} {
  if (config.LLM_PROVIDER === "stub") {
    return;
  }

  if (!config.LLM_API_KEY || !config.LLM_MODEL) {
    throw new Error("LLM_API_KEY and LLM_MODEL are required when LLM_PROVIDER=openai-compatible.");
  }
}
