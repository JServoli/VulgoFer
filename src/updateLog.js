import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import { loadServerStore, saveServerStore } from "./serverStore.js";

const execFileAsync = promisify(execFile);

async function getCurrentRevision() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"]);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function getCurrentUpdateNotes() {
  try {
    const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"]);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      summary: lines[0] ?? null,
      details: lines.slice(1),
    };
  } catch {
    return {
      summary: null,
      details: [],
    };
  }
}

export async function announceUpdate(client, details = null) {
  if (!config.updateLogChannelId) {
    return;
  }

  const revision = await getCurrentRevision();
  const notes = await getCurrentUpdateNotes();
  const summary = details ?? notes.summary ?? "Bot atualizado e reiniciado.";
  const store = await loadServerStore();
  const updateKey = revision ?? new Date().toISOString();

  if (store.lastAnnouncedUpdate === updateKey) {
    return;
  }

  const channel = await client.channels.fetch(config.updateLogChannelId);

  if (!channel?.isTextBased()) {
    throw new Error("UPDATE_LOG_CHANNEL_ID nao aponta para um canal de texto valido.");
  }

  await channel.send(
    [
      "**Log de Atualizacao**",
      `**Resumo:** ${summary}`,
      notes.details.length ? `**O que mudou:**\n${notes.details.join("\n")}` : null,
      revision ? `**Versao:** \`${revision}\`` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );

  store.lastAnnouncedUpdate = updateKey;
  await saveServerStore(store);
}
