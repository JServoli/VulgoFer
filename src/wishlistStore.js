import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const storePath = join(process.cwd(), "data", "wishlist.json");

// products[productId] = { name, path, lastPrice, lowestSeen, checkedAt,
//   watchers: { [userId]: { query, addedAt, priceWhenAdded } } }
const emptyStore = {
  products: {},
};

async function ensureStore() {
  await mkdir(dirname(storePath), { recursive: true });
}

export async function loadWishlistStore() {
  await ensureStore();

  try {
    const content = await readFile(storePath, "utf8");
    return { ...emptyStore, ...JSON.parse(content) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await saveWishlistStore(emptyStore);
    return { ...emptyStore, products: {} };
  }
}

export async function saveWishlistStore(store) {
  await ensureStore();
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

export function userItems(store, userId) {
  return Object.entries(store.products)
    .filter(([, product]) => product.watchers[userId])
    .map(([productId, product]) => ({ productId, ...product }));
}
