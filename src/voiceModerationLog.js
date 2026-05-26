import { AuditLogEvent } from "discord.js";
import { config } from "./config.js";

const AUDIT_LOG_RETRIES = 10;
const AUDIT_LOG_RETRY_DELAY = 3000;
const AUDIT_LOG_WINDOW = 90000;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRecentEntry(entry, memberId) {
  if (!entry || Date.now() - entry.createdTimestamp > AUDIT_LOG_WINDOW) {
    return false;
  }

  return entry.executor?.id && entry.executor.id !== memberId;
}

async function findVoiceAuditEntry(guild, memberId, type, { requireTarget = true } = {}) {
  const logs = await guild.fetchAuditLogs({ type, limit: 10 });

  return logs.entries.find((entry) => {
    if (!isRecentEntry(entry, memberId)) {
      return false;
    }

    if (!requireTarget) {
      return true;
    }

    return !entry.target?.id || entry.target.id === memberId;
  });
}

async function findDisconnectAuditEntry(guild, memberId) {
  return (
    (await findVoiceAuditEntry(guild, memberId, AuditLogEvent.MemberDisconnect, {
      requireTarget: false,
    })) ??
    (await findVoiceAuditEntry(guild, memberId, AuditLogEvent.MemberMove, {
      requireTarget: false,
    }))
  );
}

async function findVoiceAuditEntryWithRetry(guild, memberId, getEntry) {
  for (let attempt = 1; attempt <= AUDIT_LOG_RETRIES; attempt += 1) {
    const entry = await getEntry();

    if (entry?.executor) {
      return entry;
    }

    if (attempt < AUDIT_LOG_RETRIES) {
      await wait(AUDIT_LOG_RETRY_DELAY);
    }
  }

  const logs = await guild.fetchAuditLogs({ limit: 5 });
  const recent = logs.entries
    .filter((entry) => Date.now() - entry.createdTimestamp <= AUDIT_LOG_WINDOW)
    .map((entry) => ({
      action: entry.action,
      executor: entry.executor?.tag ?? entry.executor?.id,
      target: entry.target?.id,
      ageMs: Date.now() - entry.createdTimestamp,
    }));

  console.log("Nao encontrei audit log de call para", memberId, recent);
  return null;
}

async function sendVoiceLog(client, content) {
  const channel = await client.channels.fetch(config.voiceModerationLogChannelId);

  if (!channel?.isTextBased()) {
    throw new Error("VOICE_MODERATION_LOG_CHANNEL_ID nao aponta para um canal de texto valido.");
  }

  await channel.send(content);
}

export async function logVoiceModeration(oldState, newState) {
  if (!config.voiceModerationLogChannelId || oldState.channelId === newState.channelId) {
    return;
  }

  const member = newState.member ?? oldState.member;
  if (!member?.id || member.user.bot || !oldState.channelId) {
    return;
  }

  const entry = await findVoiceAuditEntryWithRetry(newState.guild, member.id, () =>
    newState.channelId
      ? findVoiceAuditEntry(newState.guild, member.id, AuditLogEvent.MemberMove)
      : findDisconnectAuditEntry(newState.guild, member.id)
  );

  if (!entry?.executor) {
    return;
  }

  const movedUser = `<@${member.id}>`;
  const executor = `<@${entry.executor.id}>`;
  const oldChannel = `<#${oldState.channelId}>`;

  if (newState.channelId) {
    await sendVoiceLog(
      newState.client,
      `Log de call: ${executor} moveu ${movedUser} de ${oldChannel} para <#${newState.channelId}>.`
    );
    return;
  }

  await sendVoiceLog(
    newState.client,
    `Log de call: ${executor} tirou ${movedUser} de ${oldChannel}.`
  );
}
