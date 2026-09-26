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
  birthdayAnnouncementChannelId:
    process.env.BIRTHDAY_ANNOUNCEMENT_CHANNEL_ID ??
    "769408270515044362",
  updateLogChannelId: process.env.UPDATE_LOG_CHANNEL_ID ?? "769408368762028062",
  voiceModerationLogChannelId:
    process.env.VOICE_MODERATION_LOG_CHANNEL_ID ??
    process.env.UPDATE_LOG_CHANNEL_ID ??
    "769408368762028062",
  valorantRoleId: process.env.VALORANT_ROLE_ID ?? "1507115093282787388",
  protectedUserId: process.env.DISCORD_PROTECTED_USER_ID ?? "338809624474157056",
  voiceLeaveRequiredApprovals: Number(process.env.VOICE_LEAVE_REQUIRED_APPROVALS ?? 3),
  wishlistChannelId: process.env.WISHLIST_CHANNEL_ID,
  wishlistCheckIntervalMinutes: Number(process.env.WISHLIST_CHECK_INTERVAL_MINUTES ?? 60),
  wishlistMinDropPercent: Number(process.env.WISHLIST_MIN_DROP_PERCENT ?? 1),
  wishlistMaxItemsPerUser: Number(process.env.WISHLIST_MAX_ITEMS_PER_USER ?? 10),
};
