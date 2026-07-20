import matter from "gray-matter";

const withoutSlug = (value: unknown, slug: string): unknown =>
  Array.isArray(value)
    ? value.filter((item) => {
        if (typeof item === "string") return item !== slug;
        if (item && typeof item === "object" && "slug" in item) {
          return String((item as { slug: unknown }).slug) !== slug;
        }
        return true;
      })
    : value;

export function removeContentReference(
  rawMdx: string,
  slug: string,
): Readonly<{ changed: boolean; mdx: string }> {
  const parsed = matter(rawMdx);
  const data = { ...(parsed.data as Record<string, unknown>) };
  let changed = false;

  for (const field of ["preRequisitos", "aulaSlugs", "itens"] as const) {
    const current = data[field];
    const updated = withoutSlug(current, slug);
    if (Array.isArray(current) && Array.isArray(updated)) {
      changed ||= updated.length !== current.length;
      data[field] = updated;
    }
  }

  if (!changed) return { changed: false, mdx: rawMdx };
  return { changed: true, mdx: matter.stringify(parsed.content, data) };
}
