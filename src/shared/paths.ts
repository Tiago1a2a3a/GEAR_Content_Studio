import path from "node:path";
import { realpath } from "node:fs/promises";

const contentPath = /^src\/content\/(?:aprendizado\/(?:aulas|cursos|trilhas)|projetos|noticias)\/[a-z0-9]+(?:-[a-z0-9]+)*\.mdx$/;
const imagePath =
  /^public\/images\/content\/(?:aulas|aprendizado\/(?:cursos|trilhas)|projetos|noticias)\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(png|jpg|jpeg|webp)$/;

export function isAllowedWritePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  return contentPath.test(normalized) || imagePath.test(normalized);
}

export function isAllowedContentPath(relativePath: string): boolean {
  return contentPath.test(relativePath.replaceAll("\\", "/"));
}

export function resolveConfined(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const comparisonRoot = `${resolvedRoot.toLowerCase()}${path.sep}`;
  if (
    resolved.toLowerCase() !== resolvedRoot.toLowerCase() &&
    !resolved.toLowerCase().startsWith(comparisonRoot)
  ) {
    throw new Error("O caminho tenta escapar da raiz permitida.");
  }
  return resolved;
}

export function assertAllowedPaths(paths: readonly string[]): void {
  const forbidden = paths.filter((candidate) => !isAllowedWritePath(candidate));
  if (forbidden.length) {
    throw new Error(`Arquivos fora da allowlist: ${forbidden.join(", ")}`);
  }
}

export async function resolveConfinedForWrite(
  root: string,
  relativePath: string,
): Promise<string> {
  const target = resolveConfined(root, relativePath);
  const realRoot = await realpath(root);
  let existingAncestor = path.dirname(target);
  while (true) {
    try {
      existingAncestor = await realpath(existingAncestor);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      existingAncestor = parent;
    }
  }
  const comparisonRoot = `${realRoot.toLowerCase()}${path.sep}`;
  if (
    existingAncestor.toLowerCase() !== realRoot.toLowerCase() &&
    !existingAncestor.toLowerCase().startsWith(comparisonRoot)
  ) {
    throw new Error("O caminho atravessa um link fora da raiz permitida.");
  }
  return target;
}
