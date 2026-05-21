import { config } from "./config.js";
import { loadBirthdayStore, saveBirthdayStore } from "./birthdayStore.js";

const birthdayNotices = [
  {
    daysBefore: 15,
    message: (userId) => `O aniversário de <@${userId}> é daqui 15 dias`,
  },
  {
    daysBefore: 3,
    message: (userId) => `O aniversário de <@${userId}> é daqui 3 dias`,
  },
  {
    daysBefore: 0,
    message: (userId) =>
      `O aniversário de <@${userId}> é hoje!!! @everyone vamos comemorar!!!!`,
  },
];

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    birthdayKey: `${byType.month}-${byType.day}`,
    announcementKey: `${byType.year}-${byType.month}-${byType.day}`,
  };
}

function addDays(dateParts, days) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days));

  return {
    year: date.getUTCFullYear(),
    key: `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
      date.getUTCDate()
    ).padStart(2, "0")}`,
  };
}

export async function checkBirthdays(client) {
  if (!config.guildId || !config.birthdayAnnouncementChannelId) {
    return;
  }

  const today = todayInSaoPaulo();
  const store = await loadBirthdayStore();
  const channel = await client.channels.fetch(config.birthdayAnnouncementChannelId);

  if (!channel?.isTextBased()) {
    throw new Error("BIRTHDAY_ANNOUNCEMENT_CHANNEL_ID nao aponta para um canal de texto valido.");
  }

  for (const notice of birthdayNotices) {
    const target = addDays(today, notice.daysBefore);
    const birthdayUserIds = Object.entries(store.birthdays)
      .filter(([, birthday]) => birthday.key === target.key)
      .map(([userId]) => userId);

    for (const userId of birthdayUserIds) {
      const announcementKey = `${target.year}:${target.key}:${userId}:${notice.daysBefore}`;
      if (store.announcements[announcementKey]) {
        continue;
      }

      await channel.send({
        content: notice.message(userId),
        allowedMentions: { parse: ["everyone", "users"] },
      });

      store.announcements[announcementKey] = true;
    }
  }

  await saveBirthdayStore(store);
}

export function startBirthdayScheduler(client) {
  if (!config.birthdayAnnouncementChannelId) {
    console.log("BIRTHDAY_ANNOUNCEMENT_CHANNEL_ID ausente; avisos de aniversario desativados.");
    return;
  }

  checkBirthdays(client).catch(console.error);

  setInterval(() => {
    checkBirthdays(client).catch(console.error);
  }, 60 * 60 * 1000);
}
