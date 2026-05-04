import { newId } from "../domain/ids.js";

export interface MeetingMessage {
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ActiveMeetingSession {
  id: string;
  title: string;
  project?: string | null;
  guildId: string;
  channelId: string;
  startedBy: {
    discordId: string;
    displayName: string;
  };
  startedAt: string;
  messages: MeetingMessage[];
}

export interface ClosedMeetingSession extends ActiveMeetingSession {
  endedAt: string;
  transcript: string;
}

export class MeetingSessionManager {
  private readonly sessions = new Map<string, ActiveMeetingSession>();

  start(input: {
    title: string;
    project?: string | null;
    guildId: string;
    channelId: string;
    startedBy: {
      discordId: string;
      displayName: string;
    };
    startedAt?: string;
  }): ActiveMeetingSession {
    const key = sessionKey(input.guildId, input.channelId);
    const existing = this.sessions.get(key);
    if (existing) {
      throw new Error(`A meeting is already active in this channel: ${existing.title}`);
    }

    const session: ActiveMeetingSession = {
      id: newId("meeting"),
      title: input.title,
      project: input.project ?? null,
      guildId: input.guildId,
      channelId: input.channelId,
      startedBy: input.startedBy,
      startedAt: input.startedAt ?? new Date().toISOString(),
      messages: []
    };

    this.sessions.set(key, session);
    return session;
  }

  appendMessage(input: {
    guildId: string;
    channelId: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt?: string;
  }): boolean {
    const session = this.sessions.get(sessionKey(input.guildId, input.channelId));
    if (!session || input.content.trim().length === 0) {
      return false;
    }

    session.messages.push({
      authorId: input.authorId,
      authorName: input.authorName,
      content: input.content.trim(),
      createdAt: input.createdAt ?? new Date().toISOString()
    });
    return true;
  }

  end(input: { guildId: string; channelId: string; endedAt?: string }): ClosedMeetingSession {
    const key = sessionKey(input.guildId, input.channelId);
    const session = this.sessions.get(key);
    if (!session) {
      throw new Error("No active meeting is running in this channel.");
    }

    this.sessions.delete(key);
    return {
      ...session,
      endedAt: input.endedAt ?? new Date().toISOString(),
      transcript: formatTranscript(session.messages)
    };
  }

  get(guildId: string, channelId: string): ActiveMeetingSession | undefined {
    return this.sessions.get(sessionKey(guildId, channelId));
  }
}

function sessionKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

function formatTranscript(messages: MeetingMessage[]): string {
  return messages
    .map((message) => `[${message.createdAt}] ${message.authorName} (${message.authorId}): ${message.content}`)
    .join("\n");
}
