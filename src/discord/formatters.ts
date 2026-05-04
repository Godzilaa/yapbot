import type { DecisionSummary, MeetingSummary, TaskSummary } from "../neo4j/queryService.js";

export function formatTasks(tasks: TaskSummary[]): string {
  if (tasks.length === 0) {
    return "No open tasks found.";
  }

  return tasks
    .map((task) => `- ${task.title} (${task.status}, ${task.priority})\n  id: ${task.id}${task.dueAt ? `\n  due: ${task.dueAt}` : ""}`)
    .join("\n");
}

export function formatDecisions(decisions: DecisionSummary[]): string {
  if (decisions.length === 0) {
    return "No decisions found.";
  }

  return decisions
    .map((decision) => `- ${decision.title}\n  ${decision.description}\n  id: ${decision.id}`)
    .join("\n");
}

export function formatMeetings(meetings: MeetingSummary[]): string {
  if (meetings.length === 0) {
    return "No missed meetings found.";
  }

  return meetings
    .map((meeting) => `- ${meeting.title}${meeting.startedAt ? ` (${meeting.startedAt})` : ""}\n  id: ${meeting.id}${meeting.summary ? `\n  ${meeting.summary}` : ""}`)
    .join("\n");
}

export function truncateDiscordMessage(message: string): string {
  if (message.length <= 1900) {
    return message;
  }

  return `${message.slice(0, 1880)}\n...`;
}
