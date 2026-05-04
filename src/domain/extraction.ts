import { z } from "zod";

export const taskStatusSchema = z.enum([
  "pending_review",
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled"
]);

export const decisionStatusSchema = z.enum([
  "pending_review",
  "accepted",
  "superseded",
  "rejected"
]);

export const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const riskSeveritySchema = z.enum(["low", "medium", "high"]);

export const extractedUserSchema = z.object({
  discordId: z.string().optional(),
  displayName: z.string().min(1),
  role: z.string().nullish(),
  team: z.string().nullish(),
  interests: z.array(z.string().min(1)).nullish().default([])
});

export const extractionSchema = z.object({
  meeting: z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional().nullable(),
    project: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    transcriptRef: z.string().optional().nullable()
  }),
  attendees: z.array(extractedUserSchema).default([]),
  missedUsers: z.array(extractedUserSchema).default([]),
  topics: z.array(z.object({ name: z.string().min(1) })).default([]),
  tasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    assignee: extractedUserSchema.pick({ discordId: true, displayName: true }).optional().nullable(),
    project: z.string().optional().nullable(),
    topic: z.string().optional().nullable(),
    status: taskStatusSchema.default("open"),
    priority: prioritySchema.default("normal"),
    dueAt: z.string().datetime().optional().nullable(),
    confidence: z.number().min(0).max(1),
    sourceText: z.string().max(1000).optional().nullable()
  })).default([]),
  decisions: z.array(z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    rationale: z.string().optional().nullable(),
    status: decisionStatusSchema.default("accepted"),
    affects: z.object({
      teams: z.array(z.string().min(1)).default([]),
      projects: z.array(z.string().min(1)).default([]),
      tasks: z.array(z.string().min(1)).default([])
    }).default({ teams: [], projects: [], tasks: [] }),
    confidence: z.number().min(0).max(1),
    sourceText: z.string().max(1000).optional().nullable()
  })).default([]),
  risks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    severity: riskSeveritySchema.default("medium"),
    affects: z.object({
      teams: z.array(z.string().min(1)).default([]),
      projects: z.array(z.string().min(1)).default([]),
      tasks: z.array(z.string().min(1)).default([])
    }).default({ teams: [], projects: [], tasks: [] }),
    confidence: z.number().min(0).max(1),
    sourceText: z.string().max(1000).optional().nullable()
  })).default([])
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedUser = z.infer<typeof extractedUserSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

export function validateExtraction(input: unknown): Extraction {
  return extractionSchema.parse(input);
}

export function applyConfidenceReview(extraction: Extraction, threshold: number): Extraction {
  return {
    ...extraction,
    tasks: extraction.tasks.map((task) => ({
      ...task,
      status: task.confidence < threshold ? "pending_review" : task.status
    })),
    decisions: extraction.decisions.map((decision) => ({
      ...decision,
      status: decision.confidence < threshold ? "pending_review" : decision.status
    }))
  };
}
