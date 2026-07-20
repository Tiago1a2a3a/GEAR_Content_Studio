import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { imageSize } from "image-size";

import { normalizeImageName, uniqueImageName } from "../../shared/slug";
import type { PendingImage } from "../../shared/types";

const mimeByExtension = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
} as const;

function detectMime(bytes: Uint8Array): PendingImage["mime"] | undefined {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

export async function inspectImages(paths: readonly string[]): Promise<PendingImage[]> {
  const occupied = new Set<string>();
  const results: PendingImage[] = [];
  for (const sourcePath of paths) {
    const extension = path.extname(sourcePath).toLowerCase();
    const expectedMime = mimeByExtension[extension as keyof typeof mimeByExtension];
    if (!expectedMime) throw new Error(`Formato de imagem não permitido: ${extension}`);
    const metadata = await stat(sourcePath);
    if (!metadata.isFile() || metadata.size > 10 * 1024 * 1024) {
      throw new Error("A imagem deve ser um arquivo de até 10 MiB.");
    }
    const bytes = await readFile(sourcePath);
    const actualMime = detectMime(bytes);
    if (!actualMime || actualMime !== expectedMime) {
      throw new Error(
        `A assinatura não corresponde à extensão: ${path.basename(sourcePath)}`,
      );
    }
    const dimensions = imageSize(bytes);
    if (!dimensions.width || !dimensions.height) {
      throw new Error("Não foi possível ler as dimensões da imagem.");
    }
    const normalizedName = uniqueImageName(
      normalizeImageName(path.basename(sourcePath)),
      occupied,
    );
    occupied.add(normalizedName.toLowerCase());
    results.push({
      id: randomUUID(),
      sourcePath,
      originalName: path.basename(sourcePath),
      normalizedName,
      mime: actualMime,
      bytes: metadata.size,
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  return results;
}
