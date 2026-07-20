export function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeImageName(originalName: string): string {
  const lastPart = originalName.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const extension = lastPart.split(".").at(-1)?.toLowerCase() ?? "";
  const base = lastPart.slice(0, -(extension.length + 1));
  return `${toSlug(base) || "imagem"}.${extension}`;
}

export function uniqueImageName(name: string, occupied: ReadonlySet<string>): string {
  if (!occupied.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const extension = dot >= 0 ? name.slice(dot) : "";
  let suffix = 2;
  while (occupied.has(`${base}-${suffix}${extension}`.toLowerCase())) suffix += 1;
  return `${base}-${suffix}${extension}`;
}
