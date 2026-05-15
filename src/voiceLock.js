import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { ChannelType } from "discord.js";
import { config } from "./config.js";

let leaveAllowedUntil = 0;

export function allowVoiceLeave(milliseconds = 60_000) {
  leaveAllowedUntil = Date.now() + milliseconds;
}

export function isVoiceLeaveAllowed() {
  return Date.now() < leaveAllowedUntil;
}

export async function joinLockedVoiceChannel(client) {
  if (!config.guildId || !config.voiceChannelId) {
    return false;
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channel = await guild.channels.fetch(config.voiceChannelId);

  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error("DISCORD_VOICE_CHANNEL_ID nao aponta para uma call valida.");
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch {
    connection.destroy();
    throw new Error("Nao consegui conectar na call configurada.");
  }

  return true;
}

export async function leaveLockedVoiceChannel(client) {
  allowVoiceLeave();

  const connection = getVoiceConnection(config.guildId);
  if (connection) {
    connection.destroy();
    return true;
  }

  const guild = await client.guilds.fetch(config.guildId);
  const me = await guild.members.fetchMe();

  if (me.voice.channelId) {
    await me.voice.disconnect();
    return true;
  }

  return false;
}

export async function enforceVoiceLock(client) {
  if (!config.voiceChannelId || isVoiceLeaveAllowed()) {
    return;
  }

  const guild = await client.guilds.fetch(config.guildId);
  const me = await guild.members.fetchMe();

  if (me.voice.channelId !== config.voiceChannelId) {
    await joinLockedVoiceChannel(client);
  }
}

export function startVoiceLock(client) {
  if (!config.voiceChannelId) {
    console.log("DISCORD_VOICE_CHANNEL_ID ausente; trava de call desativada.");
    return;
  }

  joinLockedVoiceChannel(client).catch(console.error);

  setInterval(() => {
    enforceVoiceLock(client).catch(console.error);
  }, 30_000);
}
