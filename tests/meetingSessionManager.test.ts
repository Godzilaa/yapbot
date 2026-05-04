import { describe, expect, it } from "vitest";
import { MeetingSessionManager } from "../src/meetings/meetingSessionManager.js";

describe("MeetingSessionManager", () => {
  it("buffers messages between start and end", () => {
    const manager = new MeetingSessionManager();
    const session = manager.start({
      title: "Backend sync",
      project: "AI Project Manager Bot",
      guildId: "guild-1",
      channelId: "channel-1",
      startedAt: "2026-05-04T10:00:00.000Z",
      startedBy: {
        discordId: "user-1",
        displayName: "Pratik"
      }
    });

    expect(session.title).toBe("Backend sync");
    expect(manager.appendMessage({
      guildId: "guild-1",
      channelId: "channel-1",
      authorId: "user-1",
      authorName: "Pratik",
      content: "I will create the Neo4j migration.",
      createdAt: "2026-05-04T10:01:00.000Z"
    })).toBe(true);

    const closed = manager.end({
      guildId: "guild-1",
      channelId: "channel-1",
      endedAt: "2026-05-04T10:30:00.000Z"
    });

    expect(closed.messages).toHaveLength(1);
    expect(closed.transcript).toContain("Pratik");
    expect(closed.transcript).toContain("I will create the Neo4j migration.");
  });

  it("does not allow two active meetings in the same channel", () => {
    const manager = new MeetingSessionManager();
    manager.start({
      title: "First",
      project: null,
      guildId: "guild-1",
      channelId: "channel-1",
      startedBy: {
        discordId: "user-1",
        displayName: "Pratik"
      }
    });

    expect(() => manager.start({
      title: "Second",
      project: null,
      guildId: "guild-1",
      channelId: "channel-1",
      startedBy: {
        discordId: "user-1",
        displayName: "Pratik"
      }
    })).toThrow(/already active/);
  });
});
