import { randomUUID } from "node:crypto";

import matter from "gray-matter";

import type { ContentType, LessonDraft } from "./types";

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

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
      {
        id: randomUUID(),
        kind: "paragraph",
        markdown: body,
      },
    ],
  };
}
