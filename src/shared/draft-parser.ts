import { randomUUID } from "node:crypto";

import matter from "gray-matter";

import type { ContentType, LessonDraft } from "./types";

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

function parseBodyBlocks(content: string) {
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  const blocks: LessonDraft["body"] = [];
  let index = 0;
  const pushParagraph = (value: string) => {
    const markdown = value.trim();
    if (markdown) blocks.push({ id: randomUUID(), kind: "paragraph", markdown });
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const video = line.match(/^<VideoEmbed\s*$/);
    if (video) {
      const chunk: string[] = [];
      while (index < lines.length && !lines[index]!.includes("/>")) {
        chunk.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) chunk.push(lines[index++]!);
      const title = chunk.join(" ").match(/titulo="([^"]+)"/)?.[1];
      const url = chunk.join(" ").match(/url="(https:\/\/[^"]+)"/)?.[1];
      if (title && url) blocks.push({ id: randomUUID(), kind: "video", titulo: title, url });
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ id: randomUUID(), kind: "heading", level: heading[1]!.length as 2 | 3 | 4, text: heading[2]!.trim() });
      index += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const language = line.slice(3).trim() || "text";
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !/^```/.test(lines[index]!)) code.push(lines[index++]!);
      if (index < lines.length) index += 1;
      blocks.push({ id: randomUUID(), kind: "code", language, code: code.join("\n") });
      continue;
    }
    if (/^---\s*$/.test(line)) {
      blocks.push({ id: randomUUID(), kind: "separator" });
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!)) quote.push(lines[index++]!.replace(/^>\s?/, ""));
      blocks.push({ id: randomUUID(), kind: "quote", markdown: quote.join("\n") });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]!)) items.push(lines[index++]!.replace(/^[-*]\s+/, ""));
      blocks.push({ id: randomUUID(), kind: "unordered-list", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index]!)) items.push(lines[index++]!.replace(/^\d+\.\s+/, ""));
      blocks.push({ id: randomUUID(), kind: "ordered-list", items });
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index]!.trim() &&
      !/^(#{2,4})\s+|^```|^---\s*$|^>\s?|^[-*]\s+|^\d+\.\s+|^<VideoEmbed\s*$/.test(lines[index]!)) {
      paragraph.push(lines[index++]!);
    }
    pushParagraph(paragraph.join("\n"));
  }
  return blocks.length ? blocks : [{ id: randomUUID(), kind: "paragraph" as const, markdown: "" }];
}

export function parsePublishedDraft(
  raw: string,
  type: ContentType,
  sourcePath: string,
  baseCommit: string,
): LessonDraft {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const cover =
    typeof data.banner === "string"
      ? data.banner
      : typeof data.imagemCapa === "string"
        ? data.imagemCapa
        : undefined;
  const projectImages = strings(data.imagens);
  const linksExternos = Array.isArray(data.linksExternos)
    ? data.linksExternos.flatMap((item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { titulo?: unknown }).titulo === "string" &&
        typeof (item as { url?: unknown }).url === "string"
          ? [
              {
                titulo: (item as { titulo: string }).titulo,
                url: (item as { url: string }).url,
              },
            ]
          : [],
      )
    : [];
  const existingDownloads = Array.isArray(data.downloads)
    ? data.downloads.flatMap((item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { titulo?: unknown }).titulo === "string" &&
        typeof (item as { arquivo?: unknown }).arquivo === "string"
          ? [
              {
                titulo: (item as { titulo: string }).titulo,
                arquivo: (item as { arquivo: string }).arquivo,
              },
            ]
          : [],
      )
    : [];
  const trailItems = Array.isArray(data.itens)
    ? data.itens.flatMap((item) =>
        item &&
        typeof item === "object" &&
        ((item as { tipo?: unknown }).tipo === "aula" ||
          (item as { tipo?: unknown }).tipo === "curso") &&
        typeof (item as { slug?: unknown }).slug === "string"
          ? [
              {
                tipo: (item as { tipo: "aula" | "curso" }).tipo,
                slug: (item as { slug: string }).slug,
              },
            ]
          : [],
      )
    : undefined;
  const body = parsed.content.trim();

  return {
    id: randomUUID(),
    schemaVersion: 1,
    baseCommit,
    sourcePath,
    contentType: type,
    slug:
      typeof data.slug === "string"
        ? data.slug
        : (sourcePath
            .split("/")
            .at(-1)
            ?.replace(/\.mdx$/, "") ?? ""),
    titulo: typeof data.titulo === "string" ? data.titulo : "",
    resumo:
      typeof data.resumo === "string"
        ? data.resumo
        : typeof data.descricao === "string"
          ? data.descricao
          : typeof data.descricaoCurta === "string"
            ? data.descricaoCurta
            : "",
    descricaoLonga:
      typeof data.descricaoLonga === "string" ? data.descricaoLonga : undefined,
    tags: strings(data.tags),
    categoria:
      typeof data.categoria === "string"
        ? data.categoria
        : typeof data.area === "string"
          ? data.area
          : undefined,
    dificuldade:
      data.dificuldade === "intermediário" || data.dificuldade === "avançado"
        ? data.dificuldade
        : "iniciante",
    dataPublicacao:
      typeof data.dataPublicacao === "string"
        ? data.dataPublicacao
        : new Date().toISOString().slice(0, 10),
    dataAtualizacao:
      typeof data.dataAtualizacao === "string" ? data.dataAtualizacao : undefined,
    autores:
      type === "noticia"
        ? typeof data.autor === "string"
          ? [data.autor]
          : []
        : strings(data.autores),
    preRequisitos: strings(data.preRequisitos),
    aulaSlugs: strings(data.aulaSlugs),
    trilhaItens: trailItems,
    videos: strings(data.videos),
    linksExternos,
    existingDownloads,
    repositorioGithub:
      typeof data.repositorioGithub === "string" ? data.repositorioGithub : undefined,
    tecnologias: strings(data.tecnologias),
    documentacao: typeof data.documentacao === "string" ? data.documentacao : undefined,
    destaque: typeof data.destaque === "boolean" ? data.destaque : undefined,
    ordem: typeof data.ordem === "number" ? data.ordem : undefined,
    status:
      type === "projeto"
        ? data.status === "concluído"
          ? "publicado"
          : "rascunho"
        : data.status === "publicado"
          ? "publicado"
          : "rascunho",
    permiteComentarios:
      typeof data.permiteComentarios === "boolean" ? data.permiteComentarios : false,
    images: [],
    existingBannerPath: cover,
    existingImagePaths: projectImages,
    body: [
      ...parseBodyBlocks(body),
      ...strings(data.videos).map((url) => ({
        id: randomUUID(),
        kind: "video" as const,
        titulo: "Vídeo da aula",
        url,
      })),
    ],
  };
}
