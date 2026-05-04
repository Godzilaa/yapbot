import type { TranscriptInput } from "./extractor.js";

export function buildExtractionSystemPrompt(): string {
  return [
    "You extract structured project-management memory from meeting transcripts.",
    "Return only valid JSON. Do not include Markdown, code fences, comments, or prose.",
    "Do not invent facts that are not supported by the transcript.",
    "Use null for unknown optional values.",
    "Use confidence from 0 to 1 for each task, decision, and risk.",
    "Prefer Discord ids when present. If only names are present, use displayName.",
    "Tasks should represent explicit or strongly implied work items.",
    "Decisions should represent settled choices, not open discussion.",
    "Risks should represent blockers, delivery risks, or unresolved concerns.",
    "Keep sourceText short and quote only the minimum supporting phrase."
  ].join(" ");
}

export function buildExtractionUserPrompt(input: TranscriptInput): string {
  return JSON.stringify({
    instruction: "Extract the meeting into the required JSON shape.",
    requiredShape: {
      meeting: {
        title: "string",
        startedAt: "ISO datetime string",
        endedAt: "ISO datetime string or null",
        project: "string or null",
        summary: "short summary string or null",
        transcriptRef: "string or null"
      },
      attendees: [
        {
          discordId: "string optional",
          displayName: "string",
          role: "string optional",
          team: "string optional",
          interests: ["string"]
        }
      ],
      missedUsers: [
        {
          discordId: "string optional",
          displayName: "string",
          role: "string optional",
          team: "string optional",
          interests: ["string"]
        }
      ],
      topics: [{ name: "string" }],
      tasks: [
        {
          title: "string",
          description: "string",
          assignee: { discordId: "string optional", displayName: "string" },
          project: "string or null",
          topic: "string or null",
          status: "open",
          priority: "low | normal | high | urgent",
          dueAt: "ISO datetime string or null",
          confidence: "number 0..1",
          sourceText: "short supporting excerpt"
        }
      ],
      decisions: [
        {
          title: "string",
          description: "string",
          rationale: "string or null",
          status: "accepted",
          affects: {
            teams: ["string"],
            projects: ["string"],
            tasks: ["task title or id string"]
          },
          confidence: "number 0..1",
          sourceText: "short supporting excerpt"
        }
      ],
      risks: [
        {
          title: "string",
          description: "string",
          severity: "low | medium | high",
          affects: {
            teams: ["string"],
            projects: ["string"],
            tasks: ["task title or id string"]
          },
          confidence: "number 0..1",
          sourceText: "short supporting excerpt"
        }
      ]
    },
    meetingContext: {
      title: input.title,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      project: input.project ?? null,
      discordGuildId: input.discordGuildId,
      discordChannelId: input.discordChannelId,
      transcriptRef: input.transcriptRef ?? null
    },
    transcript: input.transcript
  });
}
