import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

let tempCounter = 0;

// Grava num arquivo temporario e renomeia por cima do original. O rename e
// atomico, entao quem le ao mesmo tempo nunca pega o JSON pela metade
// (era a causa do "Unexpected end of JSON input" ao ligar o bot).
export async function writeJsonAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });

  tempCounter += 1;
  const tempPath = `${path}.${process.pid}.${tempCounter}.tmp`;

  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(tempPath, content);

  try {
    await rename(tempPath, path);
  } catch (error) {
    // No Windows o rename falha (EPERM) se o destino estiver aberto; em
    // producao (Linux) isso nao acontece. Cai na gravacao direta.
    await rm(tempPath, { force: true });
    if (error.code !== "EPERM" && error.code !== "EACCES") {
      throw error;
    }
    await writeFile(path, content);
  }
}
