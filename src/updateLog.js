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

export async function announceUpdate(client, details = "Bot atualizado e reiniciado.") {
  if (!config.updateLogChannelId) {
    return;
  }

  const revision = await getCurrentRevision();
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
    ["Log de Atualizacao", details, revision ? `Versao: ${revision}` : null]
      .filter(Boolean)
      .join("\n")
  );

  store.lastAnnouncedUpdate = updateKey;
  await saveServerStore(store);
}
