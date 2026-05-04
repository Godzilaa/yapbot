import {
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord.js";

export function buildCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  const meeting = new SlashCommandBuilder()
    .setName("meeting")
    .setDescription("Manage meeting memory.")
    .addSubcommand((command) =>
      command
        .setName("start")
        .setDescription("Start a new meeting session.")
        .addStringOption((option) =>
          option.setName("title").setDescription("Meeting title.").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("project").setDescription("Project name.").setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("note")
        .setDescription("Add a note or transcript excerpt to the active meeting.")
        .addStringOption((option) =>
          option.setName("text").setDescription("Text to add to meeting transcript.").setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("end")
        .setDescription("End the active meeting and extract structured memory.")
    )
    .addSubcommand((command) =>
      command
        .setName("ingest")
        .setDescription("Ingest a standalone meeting transcript into Neo4j memory.")
        .addStringOption((option) =>
          option.setName("title").setDescription("Meeting title.").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("project").setDescription("Project name.").setRequired(false)
        )
        .addStringOption((option) =>
          option.setName("transcript").setDescription("Transcript text.").setRequired(false)
        )
        .addAttachmentOption((option) =>
          option.setName("file").setDescription("Transcript text file.").setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("voice-start")
        .setDescription("Join your voice channel and start recording meeting audio.")
        .addStringOption((option) =>
          option.setName("title").setDescription("Meeting title.").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("project").setDescription("Project name.").setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("voice-end")
        .setDescription("Stop recording, transcribe audio, and ingest meeting to Neo4j.")
    );

  const tasks = new SlashCommandBuilder()
    .setName("tasks")
    .setDescription("Query task memory.")
    .addSubcommand((command) =>
      command.setName("mine").setDescription("Show open tasks assigned to you.")
    )
    .addSubcommand((command) =>
      command
        .setName("user")
        .setDescription("Show open tasks assigned to a user.")
        .addUserOption((option) =>
          option.setName("user").setDescription("Discord user.").setRequired(true)
        )
    );

  const decisions = new SlashCommandBuilder()
    .setName("decisions")
    .setDescription("Query decision memory.")
    .addSubcommand((command) =>
      command
        .setName("team")
        .setDescription("Show decisions affecting a team.")
        .addStringOption((option) =>
          option.setName("team").setDescription("Team name.").setRequired(true)
        )
    );

  const missed = new SlashCommandBuilder()
    .setName("missed")
    .setDescription("Summarize meetings you missed.")
    .addSubcommand((command) =>
      command.setName("yesterday").setDescription("Show meetings you missed yesterday.")
    );

  const task = new SlashCommandBuilder()
    .setName("task")
    .setDescription("Update task progress.")
    .addSubcommand((command) =>
      command
        .setName("update")
        .setDescription("Update task status.")
        .addStringOption((option) =>
          option.setName("task_id").setDescription("Task id.").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("New task status.")
            .setRequired(true)
            .addChoices(
              { name: "open", value: "open" },
              { name: "in progress", value: "in_progress" },
              { name: "blocked", value: "blocked" },
              { name: "done", value: "done" },
              { name: "cancelled", value: "cancelled" }
            )
        )
        .addStringOption((option) =>
          option.setName("note").setDescription("Progress note.").setRequired(false)
        )
    );

  const help = new SlashCommandBuilder()
    .setName("help")
    .setDescription("List available bot commands and usage.");

  const summary = new SlashCommandBuilder()
    .setName("summary")
    .setDescription("Show the latest meeting summary for this server.");

  return [meeting, tasks, decisions, missed, task, summary, help].map((command) => command.toJSON());
}
