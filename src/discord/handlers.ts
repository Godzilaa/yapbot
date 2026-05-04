import type { ChatInputCommandInteraction } from "discord.js";
import type { AppServices } from "../app.js";
import { taskStatusSchema } from "../domain/extraction.js";
import { formatDecisions, formatMeetings, formatTasks, truncateDiscordMessage } from "./formatters.js";

export async function handleCommand(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  if (interaction.commandName === "help") {
    await handleHelp(interaction);
    return;
  }

  if (interaction.commandName === "summary") {
    await handleSummary(interaction, services);
    return;
  }

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
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "start") {
    const title = interaction.options.getString("title", true);
    const project = interaction.options.getString("project", false);
    const session = services.meetings.start({
      title,
      project,
      guildId: interaction.guildId ?? "dm",
      channelId: interaction.channelId,
      startedBy: {
        discordId: interaction.user.id,
        displayName: interaction.user.displayName
      }
    });

    await interaction.reply({
      content: `Meeting started: ${session.title}\nmeeting id: ${session.id}\nUse /meeting note to add updates during the meeting, then /meeting end to ingest.`,
      ephemeral: false
    });
    return;
  }

  if (subcommand === "note") {
    const text = interaction.options.getString("text", true);
    const captured = services.meetings.appendMessage({
      guildId: interaction.guildId ?? "dm",
      channelId: interaction.channelId,
      authorId: interaction.user.id,
      authorName: interaction.user.displayName,
      content: text
    });

    if (!captured) {
      await interaction.reply({
        content: "No active meeting in this channel. Start one with /meeting start.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: "📝 Note added to meeting transcript.",
      ephemeral: true
    });
    return;
  }

  if (subcommand === "end") {
    await interaction.deferReply({ ephemeral: false });
    const session = services.meetings.end({
      guildId: interaction.guildId ?? "dm",
      channelId: interaction.channelId
    });

    if (session.transcript.trim().length === 0) {
      await interaction.editReply(
        `Meeting ended: ${session.title}\nNo notes were captured. Use /meeting note during the meeting to add updates.`
      );
      return;
    }

    const result = await services.ingestion.ingest({
      transcript: session.transcript,
      title: session.title,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      discordGuildId: session.guildId,
      discordChannelId: session.channelId,
      project: session.project ?? null,
      transcriptRef: `discord-session:${session.id}`
    });

    await interaction.editReply(
      `Meeting ended and ingested.\nmeeting id: ${result.meetingId}\nmessages: ${session.messages.length}\ntasks: ${result.taskCount}\ndecisions: ${result.decisionCount}\nrisks: ${result.riskCount}\npending review: ${result.pendingReviewCount}`
    );
    return;
  }

  if (subcommand === "ingest") {
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
    return;
  }

  if (subcommand === "voice-start") {
    await interaction.deferReply({ ephemeral: false });

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.editReply("This command can only be used in a server.");
      return;
    }

    let guild = interaction.guild;
    if (!guild) {
      try {
        guild = await interaction.client.guilds.fetch(guildId);
      } catch (error) {
        console.error("Error fetching guild:", error);
        await interaction.editReply("Failed to access server information.");
        return;
      }
    }

    let voiceChannel;
    try {
      const member = await guild.members.fetch(interaction.user.id);
      voiceChannel = member.voice.channel;
    } catch (error) {
      console.error("Error fetching member voice state:", error);
      voiceChannel = null;
    }

    if (!voiceChannel) {
      await interaction.editReply("You must be in a voice channel to use this command.");
      return;
    }

    const title = interaction.options.getString("title", true);
    const project = interaction.options.getString("project", false);

    try {
      const session = await services.voice.joinChannel({
        voiceChannel,
        guildId: guild.id,
        userId: interaction.user.id,
        displayName: interaction.user.displayName
      });

      await interaction.editReply(
        `🎤 Voice recording started: ${title}\nvideo session id: ${session.sessionId}\nSpeak naturally, I'm recording. Use /meeting voice-end to stop and ingest.`
      );
    } catch (error) {
      await interaction.editReply(
        `Failed to join voice channel: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
    return;
  }

  if (subcommand === "voice-end") {
    await interaction.deferReply({ ephemeral: false });

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.editReply("This command can only be used in a server.");
      return;
    }

    let guild = interaction.guild;
    if (!guild) {
      try {
        guild = await interaction.client.guilds.fetch(guildId);
      } catch (error) {
        console.error("Error fetching guild:", error);
        await interaction.editReply("Failed to access server information.");
        return;
      }
    }

    let voiceChannel;
    try {
      const member = await guild.members.fetch(interaction.user.id);
      voiceChannel = member.voice.channel;
    } catch (error) {
      console.error("Error fetching member voice state:", error);
      voiceChannel = null;
    }

    if (!voiceChannel) {
      await interaction.editReply("You must be in a voice channel to end recording.");
      return;
    }

    try {
      const audioBuffer = await services.voice.leaveChannel(guild.id, voiceChannel.id);

      if (audioBuffer.length === 0) {
        await interaction.editReply("No audio was captured. Try speaking during the voice meeting.");
        return;
      }

      // Transcribe audio
      await interaction.editReply("🎙️ Transcribing audio...");
      const transcript = await services.voice.transcribeAudio(audioBuffer, "meeting.wav");

      if (transcript.trim().length === 0) {
        await interaction.editReply("Transcription produced no text. Check audio quality and try again.");
        return;
      }

      // Get meeting session info from title (we need to store this)
      // For now, use generic title
      const now = new Date().toISOString();
      const result = await services.ingestion.ingest({
        transcript,
        title: `Voice Meeting - ${voiceChannel.name}`,
        startedAt: now,
        endedAt: null,
        discordGuildId: guild.id,
        discordChannelId: interaction.channelId,
        project: null,
        transcriptRef: `discord-voice:${voiceChannel.id}`
      });

      await interaction.editReply(
        `🎤 Meeting ingested from voice.\nmeeting id: ${result.meetingId}\ntasks: ${result.taskCount}\ndecisions: ${result.decisionCount}\nrisks: ${result.riskCount}\npending review: ${result.pendingReviewCount}`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await interaction.editReply(`Failed to process voice meeting: ${errorMsg}`);
    }
    return;
  }

  if (subcommand !== "ingest") {
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
    const tasks = await services.queries.getTasksForUser(interaction.guildId ?? "dm", interaction.user.id);
    await interaction.reply({ content: truncateDiscordMessage(formatTasks(tasks)), ephemeral: true });
    return;
  }

  if (subcommand === "user") {
    const user = interaction.options.getUser("user", true);
    const tasks = await services.queries.getTasksForUser(interaction.guildId ?? "dm", user.id);
    await interaction.reply({ content: truncateDiscordMessage(formatTasks(tasks)), ephemeral: true });
    return;
  }

  await interaction.reply({ content: "Unknown tasks command.", ephemeral: true });
}

async function handleDecisions(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  const teamName = interaction.options.getString("team", true);
  const decisions = await services.queries.getDecisionsForTeam(interaction.guildId ?? "dm", teamName);
  await interaction.reply({ content: truncateDiscordMessage(formatDecisions(decisions)), ephemeral: true });
}

async function handleMissed(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  if (interaction.options.getSubcommand() !== "yesterday") {
    await interaction.reply({ content: "Unknown missed command.", ephemeral: true });
    return;
  }

  const { start, end } = yesterdayUtcRange();
  const meetings = await services.queries.getMissedMeetings(interaction.guildId ?? "dm", interaction.user.id, start, end);
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
    discordGuildId: interaction.guildId ?? "dm",
    discordId: interaction.user.id,
    displayName: interaction.user.displayName
  });
  await services.graph.createTaskUpdate(taskId, {
    discordGuildId: interaction.guildId ?? "dm",
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

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const helpText = [
    "**Meeting Workflow (Text):**",
    "/meeting start <title> [project] — Begin meeting session.",
    "/meeting note <text> — Add note/update during active meeting.",
    "/meeting end — Close meeting and ingest transcript.",
    "",
    "**Meeting Workflow (Voice):**",
    "/meeting voice-start <title> [project] — Join your voice channel and start recording.",
    "/meeting voice-end — Stop recording, transcribe, and ingest.",
    "",
    "**Direct Ingestion:**",
    "/meeting ingest <title> [project] [transcript|file] — Ingest standalone transcript.",
    "",
    "**Task Management:**",
    "/tasks mine — Show your assigned tasks.",
    "/tasks user @user — Show user's assigned tasks.",
    "/task update <task_id> <status> [note] — Update task status.",
    "",
    "**Knowledge Queries:**",
    "/decisions team <team> — Show team decisions.",
    "/missed yesterday — Show meetings you missed yesterday.",
    "/summary — Show latest meeting summary.",
    "",
    "All data is scoped per server and stored in Neo4j."
  ].join("\n");

  await interaction.reply({ content: helpText, ephemeral: false });
}

async function handleSummary(interaction: ChatInputCommandInteraction, services: AppServices): Promise<void> {
  const summary = await services.queries.getLatestMeetingSummary(interaction.guildId ?? "dm");
  if (!summary) {
    await interaction.reply({ content: "No meetings found for this server yet.", ephemeral: true });
    return;
  }

  const text = [
    `Latest meeting: ${summary.title}`,
    summary.startedAt ? `Started: ${summary.startedAt}` : null,
    summary.summary ? `Summary: ${summary.summary}` : "Summary: not available yet"
  ]
    .filter(Boolean)
    .join("\n");

  await interaction.reply({ content: truncateDiscordMessage(text), ephemeral: true });
}
