import { formatDuration, loadServerStore, saveServerStore } from "./serverStore.js";

const activeSessions = new Map();

export function trackInitialVoiceStates(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (!state.member?.user.bot && state.channelId) {
        activeSessions.set(state.member.id, Date.now());
      }
    }
  }
}

export async function trackVoiceStateUpdate(oldState, newState) {
  const member = newState.member ?? oldState.member;

  if (!member || member.user.bot) {
    return;
  }

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (oldChannelId === newChannelId) {
    return;
  }

  if (oldChannelId && !newChannelId) {
    await closeSession(member.id);
    return;
  }

  if (!oldChannelId && newChannelId) {
    activeSessions.set(member.id, Date.now());
    return;
  }

  if (oldChannelId && newChannelId) {
    await closeSession(member.id);
    activeSessions.set(member.id, Date.now());
  }
}

async function closeSession(userId) {
  const startedAt = activeSessions.get(userId);

  if (!startedAt) {
    return;
  }

  const elapsed = Date.now() - startedAt;
  activeSessions.delete(userId);

  const store = await loadServerStore();
  store.voiceRanking[userId] = (store.voiceRanking[userId] ?? 0) + elapsed;
  await saveServerStore(store);
}

export async function getVoiceRanking(limit = 10) {
  const store = await loadServerStore();
  const totals = { ...store.voiceRanking };

  for (const [userId, startedAt] of activeSessions.entries()) {
    totals[userId] = (totals[userId] ?? 0) + Date.now() - startedAt;
  }

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([userId, milliseconds], index) => ({
      position: index + 1,
      userId,
      milliseconds,
      label: formatDuration(milliseconds),
    }));
}
