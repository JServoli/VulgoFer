import { config } from "./config.js";

const MESSAGE_INTERVAL = 6 * 60 * 60 * 1000;

async function sendRandomMessage(client) {
  const channel = await client.channels.fetch(config.randomMessageChannelId);

  if (!channel?.isTextBased()) {
    throw new Error("RANDOM_MESSAGE_CHANNEL_ID nao aponta para um canal de texto valido.");
  }

  await channel.send(config.randomMessageText);
}

export function startRandomMessageScheduler(client) {
  if (!config.randomMessageChannelId || !config.randomMessageText) {
    console.log("Mensagem aleatoria desativada.");
    return;
  }

  const scheduleNext = () => {
    setTimeout(() => {
      sendRandomMessage(client).catch(console.error).finally(scheduleNext);
    }, MESSAGE_INTERVAL);
  };

  scheduleNext();
}
