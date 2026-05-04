import type { ChatInputCommandInteraction } from "discord.js";
import type { AppServices } from "../app.js";
import { taskStatusSchema } from "../domain/extraction.js";
import { formatDecisions, formatMeetings, formatTasks, truncateDiscordMessage } from "./formatters.js";

export async function handleCommand(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  if (interaction.commandName === "meeting") {
    await handleMeeting(interaction, services);
    return;
  }

  if (interaction.commandName === "tasks") {
    await handleTasks(interaction, services);
    return;
  }

  if (interaction.commandName === "decisions") {
    await handleDecisions(interaction, services);
    return;
  }

  if (interaction.commandName === "missed") {
    await handleMissed(interaction, services);
    return;
  }

  if (interaction.commandName === "task") {
    await handleTask(interaction, services);
    return;
  }

  await interaction.reply({ content: "Unknown command.", ephemeral: true });
}

async function handleMeeting(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  if (interaction.options.getSubcommand() !== "ingest") {
    await interaction.reply({ content: "Unknown meeting command.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const transcript = await readTranscript(interaction);
  const title = interaction.options.getString("title", true);
  const project = interaction.options.getString("project", false);
  const now = new Date().toISOString();

  const result = await services.ingestion.ingest({
    transcript,
    title,
    startedAt: now,
    endedAt: null,
    discordGuildId: interaction.guildId ?? "dm",
    discordChannelId: interaction.channelId,
    project,
    transcriptRef: null
  });

  await interaction.editReply(
    `Meeting ingested.\nmeeting id: ${result.meetingId}\ntasks: ${result.taskCount}\ndecisions: ${result.decisionCount}\nrisks: ${result.riskCount}\npending review: ${result.pendingReviewCount}`
  );
}

async function handleTasks(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "mine") {
    const tasks = await services.queries.getTasksForUser(interaction.user.id);
    await interaction.reply({ content: truncateDiscordMessage(formatTasks(tasks)), ephemeral: true });
    return;
  }

  if (subcommand === "user") {
    const user = interaction.options.getUser("user", true);
    const tasks = await services.queries.getTasksForUser(user.id);
    await interaction.reply({ content: truncateDiscordMessage(formatTasks(tasks)), ephemeral: true });
    return;
  }

  await interaction.reply({ content: "Unknown tasks command.", ephemeral: true });
}

async function handleDecisions(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  const teamName = interaction.options.getString("team", true);
  const decisions = await services.queries.getDecisionsForTeam(teamName);
  await interaction.reply({ content: truncateDiscordMessage(formatDecisions(decisions)), ephemeral: true });
}

async function handleMissed(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  if (interaction.options.getSubcommand() !== "yesterday") {
    await interaction.reply({ content: "Unknown missed command.", ephemeral: true });
    return;
  }

  const { start, end } = yesterdayUtcRange();
  const meetings = await services.queries.getMissedMeetings(interaction.user.id, start, end);
  await interaction.reply({ content: truncateDiscordMessage(formatMeetings(meetings)), ephemeral: true });
}

async function handleTask(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  if (interaction.options.getSubcommand() !== "update") {
    await interaction.reply({ content: "Unknown task command.", ephemeral: true });
    return;
  }

  const taskId = interaction.options.getString("task_id", true);
  const status = taskStatusSchema.parse(interaction.options.getString("status", true));
  const note = interaction.options.getString("note", false) ?? undefined;

  await services.graph.upsertUser({
    discordId: interaction.user.id,
    displayName: interaction.user.displayName
  });
  await services.graph.createTaskUpdate(taskId, {
    status,
    note,
    actorDiscordId: interaction.user.id
  });

  await interaction.reply({ content: `Updated ${taskId} to ${status}.`, ephemeral: true });
}

async function readTranscript(interaction: ChatInputCommandInteraction): Promise<string> {
  const inlineTranscript = interaction.options.getString("transcript", false);
  if (inlineTranscript) {
    return inlineTranscript;
  }

  const attachment = interaction.options.getAttachment("file", false);
  if (!attachment) {
    return "";
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Could not fetch transcript attachment: ${response.status}`);
  }
  return response.text();
}

function yesterdayUtcRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start: start.toISOString(), end: end.toISOString() };
}
