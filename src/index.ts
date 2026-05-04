import { createAppServices } from "./app.js";
import { loadConfig } from "./config/env.js";
import { startDiscordBot } from "./discord/bot.js";

const config = loadConfig();
const services = createAppServices(config);

process.on("SIGINT", async () => {
  await services.driver.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await services.driver.close();
  process.exit(0);
});

await startDiscordBot(config, services);
