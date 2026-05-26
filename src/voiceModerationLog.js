import { AuditLogEvent } from "discord.js";
import { config } from "./config.js";

const AUDIT_LOG_WAIT = 4000;
const AUDIT_LOG_WINDOW = 45000;

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
  const logs = await guild.fetchAuditLogs({ type, limit: 5 });

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

  await wait(AUDIT_LOG_WAIT);

  const entry = newState.channelId
    ? await findVoiceAuditEntry(newState.guild, member.id, AuditLogEvent.MemberMove)
    : (await findVoiceAuditEntry(newState.guild, member.id, AuditLogEvent.MemberDisconnect, {
        requireTarget: false,
      })) ??
      (await findVoiceAuditEntry(newState.guild, member.id, AuditLogEvent.MemberMove, {
        requireTarget: false,
      }));

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
