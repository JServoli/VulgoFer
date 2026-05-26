import { loadServerStore, saveServerStore } from "./serverStore.js";

const scheduledMessages = [
  {
    id: "arthur-daniel-2028-05-26",
    date: "2028-05-26",
    channelId: "769408270515044362",
    content:
      "@everyone O Arthur foi corno por causa de uma discussao com o Daniel?\n" +
      "Print de confirmacao: https://prnt.sc/A9jWE4iDMGKd",
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

  return `${byType.year}-${byType.month}-${byType.day}`;
}

async function sendScheduledMessages(client) {
  const today = todayInSaoPaulo();
  const store = await loadServerStore();

  for (const message of scheduledMessages) {
    if (store.scheduledMessagesSent[message.id] || today < message.date) {
      continue;
    }

    const channel = await client.channels.fetch(message.channelId);

    if (!channel?.isTextBased()) {
      throw new Error(`Canal agendado invalido: ${message.channelId}`);
    }

    await channel.send({
      content: message.content,
      allowedMentions: { parse: ["everyone"] },
    });

    store.scheduledMessagesSent[message.id] = new Date().toISOString();
  }

  await saveServerStore(store);
}

export function startScheduledMessages(client) {
  sendScheduledMessages(client).catch(console.error);

  setInterval(() => {
    sendScheduledMessages(client).catch(console.error);
  }, 60 * 60 * 1000);
}
