// Busca de precos no Zoom (zoom.com.br), comparador de lojas brasileiras.
// O site e Next.js: os dados vem prontos no <script id="__NEXT_DATA__">,
// entao basta fetch + JSON.parse, sem navegador headless.

const baseUrl = "https://www.zoom.com.br";
const requestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Accept: "text/html",
};

async function fetchNextData(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Zoom respondeu HTTP ${response.status} para ${path}`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

  if (!match) {
    throw new Error(`Zoom mudou o layout: __NEXT_DATA__ nao encontrado em ${path}`);
  }

  return JSON.parse(match[1]);
}

export function buyLink(offerId) {
  // O Zoom redireciona esse link direto para a pagina do produto na loja.
  return `${baseUrl}/lead?oid=${offerId}&channel=1`;
}

export function formatPrice(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Quantas palavras da busca aparecem no nome. O Zoom ordena por popularidade,
// entao "ps5 slim" viria com o PS5 comum primeiro sem esse ajuste.
function matchScore(query, name) {
  const target = normalize(name);
  return normalize(query)
    .split(/\s+/)
    .filter((word) => word.length > 1 && target.includes(word)).length;
}

// Retorna os produtos (agregados de varias lojas) que batem com o texto.
export async function searchProducts(query, limit = 5) {
  const data = await fetchNextData(`/search?q=${encodeURIComponent(query)}`);
  const hits = data.props?.initialReduxState?.hits?.hits ?? [];

  return hits
    .filter((hit) => hit.type === "product" && hit.url && hit.price > 0)
    .map((hit, position) => ({ hit, position, score: matchScore(query, hit.name) }))
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map(({ hit }) => ({
      id: String(hit.sourceId),
      name: hit.name.trim(),
      path: hit.url,
      price: hit.price,
      storeCount: hit.storeCount,
      image: hit.image,
    }));
}

// Detalhes de um produto: ofertas por loja (mais baratas primeiro) e historico.
export async function getProductOffers(product) {
  const data = await fetchNextData(product.path);
  const state = data.props?.initialReduxState ?? {};
  const offerList = state.offers?.offerList ?? [];

  const offers = offerList
    .filter((offer) => offer.price > 0)
    .map((offer) => ({
      id: String(offer.id),
      store: offer.sellerName,
      price: offer.price,
      link: buyLink(offer.id),
    }))
    .sort((a, b) => a.price - b.price);

  const historyDays = state.priceHistory?.priceHistory?.[product.id]?.days ?? [];
  const historyPrices = historyDays.map((day) => day.price).filter((price) => price > 0);

  return {
    offers,
    bestOffer: offers[0] ?? null,
    lowestInHistory: historyPrices.length ? Math.min(...historyPrices) : null,
    historyDays: historyDays.length,
    url: `${baseUrl}${product.path}`,
  };
}
