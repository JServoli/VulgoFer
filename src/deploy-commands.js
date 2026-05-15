import { REST, Routes } from "discord.js";
import { commandData } from "./commands.js";
import { config } from "./config.js";

const rest = new REST({ version: "10" }).setToken(config.token);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

console.log(
  config.guildId
    ? "Registrando comandos no servidor de teste..."
    : "Registrando comandos globais..."
);

await rest.put(route, { body: commandData });

console.log("Comandos registrados com sucesso.");
