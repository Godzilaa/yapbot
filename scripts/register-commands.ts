import { REST, Routes } from "discord.js";
import { loadConfig, requireDiscordConfig } from "../src/config/env.js";
import { buildCommands } from "../src/discord/commands.js";

const config = loadConfig();
requireDiscordConfig(config);

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
const commands = buildCommands();

if (config.DISCORD_GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: commands }
  );
  console.log(`Registered ${commands.length} guild commands.`);
} else {
  await rest.put(
    Routes.applicationCommands(config.DISCORD_CLIENT_ID),
    { body: commands }
  );
  console.log(`Registered ${commands.length} global commands.`);
}
