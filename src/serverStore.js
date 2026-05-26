import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const storePath = join(process.cwd(), "data", "server.json");

const emptyStore = {
  phrases: [],
  counters: {
    protectedKickAttempts: 0,
  },
  lastAnnouncedUpdate: null,
  scheduledMessagesSent: {},
  voiceRanking: {},
};

async function ensureStore() {
  await mkdir(dirname(storePath), { recursive: true });
}

export async function loadServerStore() {
  await ensureStore();

  try {
    const content = await readFile(storePath, "utf8");
    return mergeStore(JSON.parse(content));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await saveServerStore(emptyStore);
    return mergeStore({});
  }
}

export async function saveServerStore(store) {
  await ensureStore();
  await writeFile(storePath, `${JSON.stringify(mergeStore(store), null, 2)}\n`);
}

function mergeStore(store) {
  return {
    ...emptyStore,
    ...store,
    counters: {
      ...emptyStore.counters,
      ...store.counters,
    },
    voiceRanking: {
      ...emptyStore.voiceRanking,
      ...store.voiceRanking,
    },
    scheduledMessagesSent: {
      ...emptyStore.scheduledMessagesSent,
      ...store.scheduledMessagesSent,
    },
  };
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
