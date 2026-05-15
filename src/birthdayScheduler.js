import { config } from "./config.js";
import { loadBirthdayStore, saveBirthdayStore } from "./birthdayStore.js";

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: byType.year,
    birthdayKey: `${byType.month}-${byType.day}`,
    announcementKey: `${byType.year}-${byType.month}-${byType.day}`,
  };
}

export async function checkBirthdays(client) {
  if (!config.guildId || !config.announcementChannelId) {
    return;
  }

  const today = todayInSaoPaulo();
  const store = await loadBirthdayStore();
  const birthdayUserIds = Object.entries(store.birthdays)
    .filter(([, birthday]) => birthday.key === today.birthdayKey)
    .map(([userId]) => userId);

  for (const userId of birthdayUserIds) {
    const announcementKey = `${today.announcementKey}:${userId}`;
    if (store.announcements[announcementKey]) {
      continue;
    }

    const channel = await client.channels.fetch(config.announcementChannelId);
    await channel.send({
      content: `@everyone Hoje e aniversario de <@${userId}>!`,
      allowedMentions: { parse: ["everyone", "users"] },
    });

    store.announcements[announcementKey] = true;
  }

  await saveBirthdayStore(store);
}

export function startBirthdayScheduler(client) {
  if (!config.announcementChannelId) {
    console.log("DISCORD_ANNOUNCEMENT_CHANNEL_ID ausente; avisos de aniversario desativados.");
    return;
  }

  checkBirthdays(client).catch(console.error);

  setInterval(() => {
    checkBirthdays(client).catch(console.error);
  }, 60 * 60 * 1000);
}
