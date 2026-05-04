import {
  VoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
  EndBehaviorType
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import fs from "fs";
import path from "path";
import { newId } from "../domain/ids.js";
import type { AppConfig } from "../config/env.js";

export interface VoiceSession {
  sessionId: string;
  guildId: string;
  channelId: string;
  connection: VoiceConnection;
  audioChunks: Buffer[];
  startedAt: Date;
  startedBy: {
    discordId: string;
    displayName: string;
  };
}

/**
 * Manages voice channel connections and audio transcription via Groq
 */
export class VoiceMeetingManager {
  private readonly voiceSessions = new Map<string, VoiceSession>();
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Join a voice channel and start capturing audio
   */
  async joinChannel(input: {
    voiceChannel: VoiceBasedChannel;
    guildId: string;
    userId: string;
    displayName: string;
  }): Promise<VoiceSession> {
    const key = this.sessionKey(input.guildId, input.voiceChannel.id);

    // Check if already connected
    if (this.voiceSessions.has(key)) {
      throw new Error("Already recording in this voice channel");
    }

    const connection = joinVoiceChannel({
      channelId: input.voiceChannel.id,
      guildId: input.guildId,
      adapterCreator: input.voiceChannel.guild.voiceAdapterCreator
    });

    // Set up receiver for audio
    const receiver = connection.receiver;

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[voice] Connected to voice channel ${input.voiceChannel.name} in guild ${input.guildId}`);

      // Subscribe to user audio
      receiver.subscribe(input.userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 5000
        }
      });
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          connection.destroy(),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
      } catch (error) {
        console.error("[voice] Error destroying connection:", error);
      }
    });

    const session: VoiceSession = {
      sessionId: newId("voice-session"),
      guildId: input.guildId,
      channelId: input.voiceChannel.id,
      connection,
      audioChunks: [],
      startedAt: new Date(),
      startedBy: {
        discordId: input.userId,
        displayName: input.displayName
      }
    };

    this.voiceSessions.set(key, session);

    // Start collecting audio
    const audioStream = receiver.subscribe(input.userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 5000
      }
    });

    audioStream.on("data", (chunk: Buffer) => {
      session.audioChunks.push(chunk);
    });

    return session;
  }

  /**
   * Leave voice channel and return captured audio as buffer
   */
  async leaveChannel(guildId: string, channelId: string): Promise<Buffer> {
    const key = this.sessionKey(guildId, channelId);
    const session = this.voiceSessions.get(key);

    if (!session) {
      throw new Error("No active voice session in this channel");
    }

    // Disconnect
    session.connection.destroy();
    this.voiceSessions.delete(key);

    // Concatenate audio chunks
    return Buffer.concat(session.audioChunks);
  }

  /**
   * Transcribe audio buffer using Groq API
   */
  async transcribeAudio(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<string> {
    if (!this.config.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    try {
      // Create FormData with audio file
      const formData = new FormData();
      const audioData = new Uint8Array(audioBuffer);
      const blob = new Blob([audioData], { type: "audio/wav" });
      formData.append("file", blob, filename);
      formData.append("model", "whisper-large-v3-turbo");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.GROQ_API_KEY}`
        },
        body: formData as any
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { text?: string; error?: string };
      return data.text || "";
    } catch (error) {
      console.error("[voice] Transcription error:", error);
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current session for a guild:channel
   */
  getSession(guildId: string, channelId: string): VoiceSession | undefined {
    return this.voiceSessions.get(this.sessionKey(guildId, channelId));
  }

  /**
   * Check if recording in channel
   */
  isRecording(guildId: string, channelId: string): boolean {
    return this.voiceSessions.has(this.sessionKey(guildId, channelId));
  }

  private sessionKey(guildId: string, channelId: string): string {
    return `${guildId}:${channelId}`;
  }
}
