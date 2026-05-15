import "dotenv/config";

const requiredEnv = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  }
}

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  voiceChannelId: process.env.DISCORD_VOICE_CHANNEL_ID,
  announcementChannelId: process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID,
  protectedUserId: process.env.DISCORD_PROTECTED_USER_ID ?? "338809624474157056",
  voiceLeaveRequiredApprovals: Number(process.env.VOICE_LEAVE_REQUIRED_APPROVALS ?? 3),
};
