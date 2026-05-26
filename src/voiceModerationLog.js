import { AuditLogEvent } from "discord.js";
import { config } from "./config.js";

const AUDIT_LOG_WAIT = 1200;
const AUDIT_LOG_WINDOW = 8000;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRelevantEntry(entry, memberId) {
  if (!entry || Date.now() - entry.createdTimestamp > AUDIT_LOG_WINDOW) {
    return false;
  }

  if (entry.executor?.id === memberId) {
    return false;
  }

  return !entry.target?.id || entry.target.id === memberId;
}

async function findVoiceAuditEntry(guild, memberId, type) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 });

  return logs.entries.find((entry) => isRelevantEntry(entry, memberId));
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

  const auditType = newState.channelId ? AuditLogEvent.MemberMove : AuditLogEvent.MemberDisconnect;
  await wait(AUDIT_LOG_WAIT);

  const entry = await findVoiceAuditEntry(newState.guild, member.id, auditType);
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
