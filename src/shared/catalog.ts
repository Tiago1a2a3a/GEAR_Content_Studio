import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import MiniSearch from "minisearch";

import type { CatalogEntry, CatalogFilter, ContentType } from "./types";

const collections: ReadonlyArray<
  readonly [ContentType, string, string[], string | undefined]
> = [
  ["aula", "src/content/aprendizado/aulas", ["preRequisitos"], "resumo"],
  [
    "curso",
    "src/content/aprendizado/cursos",
    ["aulaSlugs", "preRequisitos"],
    "descricao",
  ],
  ["trilha", "src/content/aprendizado/trilhas", ["itens"], "descricaoCurta"],
  ["projeto", "src/content/projetos", [], "descricaoCurta"],
  ["noticia", "src/content/noticias", [], "resumo"],
];

const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (item && typeof item === "object" && "slug" in item) {
          return [String((item as { slug: unknown }).slug)];
        }
        return [];
      })
    : [];

export function plainBody(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseCatalog(repositoryRoot: string): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  for (const [type, relativeDirectory, relationFields, summaryField] of collections) {
    const directory = path.join(repositoryRoot, relativeDirectory);
    let names: string[];
    try {
      names = (await readdir(directory)).filter((name) => name.endsWith(".mdx"));
    } catch {
      continue;
    }
    for (const name of names) {
      const absolutePath = path.join(directory, name);
      const raw = await readFile(absolutePath, "utf8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;
      const slug = String(data.slug ?? path.basename(name, ".mdx"));
      const outgoingRelations = relationFields.flatMap((field) =>
        asStrings(data[field]),
      );
      entries.push({
        type,
        slug,
        titulo: String(data.titulo ?? slug),
        status: String(data.status ?? "desconhecido"),
        summary: summaryField ? String(data[summaryField] ?? "") : "",
        tags: asStrings(data.tags),
        category:
          typeof data.categoria === "string"
            ? data.categoria
            : typeof data.area === "string"
              ? data.area
              : undefined,
        difficulty: typeof data.dificuldade === "string" ? data.dificuldade : undefined,
        sourcePath: path.relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
        outgoingRelations,
        incomingRelations: [],
        bodyText: plainBody(parsed.content),
      });
    }
  }

  return entries.map((entry) => ({
    ...entry,
    incomingRelations: entries
      .filter((candidate) => candidate.outgoingRelations.includes(entry.slug))
      .map((candidate) => `${candidate.type}:${candidate.slug}`),
  }));
}

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function filterCatalog(
  entries: readonly CatalogEntry[],
  filter: CatalogFilter = {},
): CatalogEntry[] {
  let candidates = [...entries];
  if (filter.query?.trim()) {
    const miniSearch = new MiniSearch<CatalogEntry>({
      fields: ["titulo", "slug", "summary", "tags", "bodyText"],
      storeFields: ["slug", "type"],
      idField: "sourcePath",
      processTerm: (term) => normalize(term),
      searchOptions: { prefix: true, fuzzy: 0.2 },
    });
    miniSearch.addAll(candidates);
    const paths = new Set(miniSearch.search(filter.query).map((result) => result.id));
    candidates = candidates.filter((entry) => paths.has(entry.sourcePath));
  }
  return candidates.filter(
    (entry) =>
      (!filter.type || entry.type === filter.type) &&
      (!filter.status || entry.status === filter.status) &&
      (!filter.difficulty || entry.difficulty === filter.difficulty) &&
      (!filter.category || entry.category === filter.category) &&
      (!filter.tag || entry.tags.includes(filter.tag)),
  );
}
