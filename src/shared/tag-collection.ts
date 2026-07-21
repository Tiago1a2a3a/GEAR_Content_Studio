export const normalizeTag = (tag: string): string =>
  tag
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

export function rewriteTags(
  tags: readonly string[],
  tag: string,
  replacement?: string,
): string[] {
  const target = normalizeTag(tag);
  const next = tags.flatMap((current) => {
    if (normalizeTag(current) !== target) return [current.trim()];
    return replacement ? [replacement.trim()] : [];
  });
  const seen = new Set<string>();
  return next.filter((current) => {
    const normalized = normalizeTag(current);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
