import { config } from "./config.js";
import { formatPrice, getProductOffers } from "./priceSource.js";
import { loadWishlistStore, saveWishlistStore } from "./wishlistStore.js";

const delayBetweenProductsMs = 5_000;
let checking = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWishlistChannel(client) {
  const channel = await client.channels.fetch(config.wishlistChannelId);

  if (!channel?.isTextBased()) {
    throw new Error("WISHLIST_CHANNEL_ID nao aponta para um canal de texto valido.");
  }

  return channel;
}

function historyLine(details) {
  if (!details.lowestInHistory) {
    return null;
  }

  return `Menor preco dos ultimos ${details.historyDays} dias: ${formatPrice(details.lowestInHistory)}`;
}

// Resposta imediata do /wishlist adicionar: melhores precos de agora.
export async function postWishlistReport(client, userId, product, details) {
  const channel = await getWishlistChannel(client);
  // offers ja vem do mais barato: fica so a melhor oferta de cada loja
  const bestPerStore = details.offers.filter(
    (offer, index, offers) => offers.findIndex((other) => other.store === offer.store) === index
  );
  const offerLines = bestPerStore
    .slice(0, 3)
    .map((offer, index) => `${index + 1}. **${formatPrice(offer.price)}** - ${offer.store} - <${offer.link}>`);

  const content = [
    `🔎 <@${userId}> adicionou **${product.name}** na wishlist.`,
    offerLines.length ? "Melhores precos agora:" : "Nenhuma loja com oferta ativa agora.",
    ...offerLines,
    historyLine(details),
    `Comparar todas as lojas: <${details.url}>`,
    "Vou avisar aqui quando o preco cair.",
  ]
    .filter(Boolean)
    .join("\n");

  await channel.send({ content, allowedMentions: { users: [userId] } });
}

async function sendDropAlert(channel, product, details, previousPrice) {
  const best = details.bestOffer;
  const userIds = Object.keys(product.watchers);
  const dropPercent = Math.round((1 - best.price / previousPrice) * 100);
  const isHistoricLow = details.lowestInHistory && best.price <= details.lowestInHistory;

  const content = [
    `📉 ${userIds.map((userId) => `<@${userId}>`).join(" ")} **${product.name}** baixou!`,
    `${formatPrice(previousPrice)} → **${formatPrice(best.price)}** (-${dropPercent}%) na ${best.store}`,
    isHistoricLow ? "🔥 Menor preco do historico recente." : historyLine(details),
    `Comprar: ${best.link}`,
  ]
    .filter(Boolean)
    .join("\n");

  await channel.send({ content, allowedMentions: { users: userIds } });
}

export async function checkWishlistPrices(client) {
  if (checking) {
    return;
  }

  checking = true;

  try {
    const channel = await getWishlistChannel(client);
    const store = await loadWishlistStore();
    const minDrop = config.wishlistMinDropPercent / 100;

    for (const [productId, product] of Object.entries(store.products)) {
      if (!Object.keys(product.watchers).length) {
        delete store.products[productId];
        continue;
      }

      try {
        const details = await getProductOffers({ id: productId, path: product.path });
        const best = details.bestOffer;

        if (best) {
          const previousPrice = product.lastPrice;

          if (previousPrice && best.price <= previousPrice * (1 - minDrop)) {
            await sendDropAlert(channel, product, details, previousPrice);
          }

          product.lastPrice = best.price;
          product.lowestSeen = Math.min(product.lowestSeen ?? best.price, best.price);
        }

        product.checkedAt = new Date().toISOString();
        await saveWishlistStore(store);
      } catch (error) {
        console.error(`Wishlist: falha ao checar ${product.name}:`, error.message);
      }

      await sleep(delayBetweenProductsMs);
    }

    await saveWishlistStore(store);
  } finally {
    checking = false;
  }
}

export function startWishlistMonitor(client) {
  if (!config.wishlistChannelId) {
    console.log("WISHLIST_CHANNEL_ID ausente; radar de promocoes desativado.");
    return;
  }

  const intervalMs = config.wishlistCheckIntervalMinutes * 60 * 1000;

  setTimeout(() => {
    checkWishlistPrices(client).catch(console.error);
  }, 2 * 60 * 1000);

  setInterval(() => {
    checkWishlistPrices(client).catch(console.error);
  }, intervalMs);
}
