import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const storePath = join(process.cwd(), "data", "birthdays.json");

const emptyStore = {
  birthdays: {},
  announcements: {},
};

async function ensureStore() {
  await mkdir(dirname(storePath), { recursive: true });
}

export async function loadBirthdayStore() {
  await ensureStore();

  try {
    const content = await readFile(storePath, "utf8");
    return { ...emptyStore, ...JSON.parse(content) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await saveBirthdayStore(emptyStore);
    return { ...emptyStore };
  }
}

export async function saveBirthdayStore(store) {
  await ensureStore();
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

export function parseBirthday(input) {
  const match = input.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(2024, month - 1, day));

  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
    return null;
  }

  return {
    day,
    month,
    key: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
  };
}
