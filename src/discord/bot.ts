import { Client, Events, GatewayIntentBits } from "discord.js";
import { MessageFlags } from "discord.js";
import type { AppConfig } from "../config/env.js";
import { requireDiscordConfig } from "../config/env.js";
import type { AppServices } from "../app.js";
import { handleCommand } from "./handlers.js";

export async function startDiscordBot(config: AppConfig, services: AppServices): Promise<Client> {
  requireDiscordConfig(config);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Discord bot ready as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      await handleCommand(interaction, services);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unknown error";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`Command failed: ${message}`);
      } else {
        await interaction.reply({ content: `Command failed: ${message}`, flags: MessageFlags.Ephemeral });
      }
    }
  });

  await client.login(config.DISCORD_TOKEN);
  return client;
}
