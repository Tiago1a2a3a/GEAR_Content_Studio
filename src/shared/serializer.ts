import { stringify } from "yaml";

import type { ContentBlock, LessonDraft } from "./types";
import { DEFAULT_COVER_PATH } from "./content-defaults";

const contentDirectories = {
  aula: "aulas",
  curso: "aprendizado/cursos",
  trilha: "aprendizado/trilhas",
  projeto: "projetos",
  noticia: "noticias",
} as const;

const unsafeBody = [
  /^\s*import\s/m,
  /^\s*export\s/m,
  /<[A-Z][A-Za-z0-9.]*/,
  /<\/?[a-z][^>]*>/i,
  /<script\b/i,
  /javascript:/i,
];

function publicImagePath(draft: LessonDraft, name: string): string {
  const type = draft.contentType ?? "aula";
  return `/images/content/${contentDirectories[type]}/${draft.slug}/${name}`;
}

function blockToMdx(block: ContentBlock, draft: LessonDraft): string {
  switch (block.kind) {
    case "paragraph":
      return block.markdown.trim();
    case "heading":
      return `${"#".repeat(block.level)} ${block.text.trim()}`;
    case "unordered-list":
      return block.items.map((item) => `- ${item.trim()}`).join("\n");
    case "ordered-list":
      return block.items
        .map((item, index) => `${index + 1}. ${item.trim()}`)
        .join("\n");
    case "image": {
      const image = draft.images.find((candidate) => candidate.id === block.imageId);
      if (!image) throw new Error(`Imagem não encontrada: ${block.imageId}`);
      return `![${block.alt.trim()}](${publicImagePath(draft, image.normalizedName)})`;
    }
    case "code":
      return `\`\`\`${block.language.trim()}\n${block.code.replace(/\s+$/, "")}\n\`\`\``;
    case "video":
      return `<VideoEmbed\n  titulo="${block.titulo.replaceAll('"', "&quot;")}"\n  url="${block.url}"\n/>`;
    case "quote":
      return block.markdown
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "separator":
      return "---";
  }
}

export function serializeBody(draft: LessonDraft): string {
  return draft.body
    .map((block) => {
      const rendered = blockToMdx(block, draft);
      if (
        block.kind !== "code" &&
        block.kind !== "video" &&
        unsafeBody.some((pattern) => pattern.test(rendered))
      ) {
        throw new Error(
          "O corpo contém import, export, JSX, HTML, script ou URL insegura.",
        );
      }
      return rendered;
    })
    .filter(Boolean)
    .join("\n\n");
}

function serializeFrontmatter(draft: LessonDraft): Record<string, unknown> {
  const type = draft.contentType ?? "aula";
  const banner = draft.bannerImageId
    ? draft.images.find((image) => image.id === draft.bannerImageId)
    : undefined;
  if (draft.bannerImageId && !banner) {
    throw new Error("Imagem de capa não encontrada.");
  }

  const base = { slug: draft.slug, titulo: draft.titulo.trim() };
  const cover = banner
    ? publicImagePath(draft, banner.normalizedName)
    : (draft.existingBannerPath ?? DEFAULT_COVER_PATH);
  const tags = draft.tags.map((value) => value.trim());

  if (type === "aula") {
    return {
      ...base,
      banner: cover,
      resumo: draft.resumo.trim(),
      ...(tags.length ? { tags } : {}),
      ...(draft.categoria?.trim() ? { categoria: draft.categoria.trim() } : {}),
      dificuldade: draft.dificuldade,
      dataPublicacao: draft.dataPublicacao,
      ...(draft.dataAtualizacao ? { dataAtualizacao: draft.dataAtualizacao } : {}),
      autores: draft.autores.map((value) => value.trim()),
      ...(draft.preRequisitos.length ? { preRequisitos: draft.preRequisitos } : {}),
      ...(draft.linksExternos.length ? { linksExternos: draft.linksExternos } : {}),
      ...(draft.downloads?.length || draft.existingDownloads?.length
        ? {
            downloads: [
              ...(draft.existingDownloads ?? []),
              ...(draft.downloads ?? []).map((download) => ({
                titulo: download.originalName,
                arquivo: `/downloads/aulas/${draft.slug}/${download.normalizedName}`,
              })),
            ],
          }
        : {}),
      ...(draft.repositorioGithub
        ? { repositorioGithub: draft.repositorioGithub }
        : {}),
      status: draft.status,
      permiteComentarios: draft.permiteComentarios,
    };
  }

  if (type === "curso") {
    return {
      ...base,
      descricao: draft.resumo.trim(),
      imagemCapa: cover,
      ...(draft.dataPublicacao ? { dataPublicacao: draft.dataPublicacao } : {}),
      ...(draft.destaque !== undefined ? { destaque: draft.destaque } : {}),
      dificuldade: draft.dificuldade,
      ...(draft.categoria?.trim() ? { categoria: draft.categoria.trim() } : {}),
      ...(tags.length ? { tags } : {}),
      ...(draft.preRequisitos.length ? { preRequisitos: draft.preRequisitos } : {}),
      aulaSlugs: draft.aulaSlugs ?? [],
      status: draft.status,
    };
  }

  if (type === "trilha") {
    return {
      ...base,
      descricaoCurta: draft.resumo.trim(),
      ...(draft.descricaoLonga?.trim()
        ? { descricaoLonga: draft.descricaoLonga.trim() }
        : {}),
      imagemCapa: cover,
      area: draft.categoria?.trim() || "Geral",
      ordem: draft.ordem ?? 1,
      ...(draft.dataPublicacao ? { dataPublicacao: draft.dataPublicacao } : {}),
      itens: draft.trilhaItens ?? [],
      status: draft.status,
    };
  }

  if (type === "projeto") {
    return {
      ...base,
      descricaoCurta: draft.resumo.trim(),
      ...(draft.descricaoLonga?.trim()
        ? { descricaoLonga: draft.descricaoLonga.trim() }
        : {}),
      ...(draft.images.length || draft.existingImagePaths?.length
        ? {
            imagens: [
              ...(draft.existingImagePaths ?? []),
              ...draft.images.map((image) =>
                publicImagePath(draft, image.normalizedName),
              ),
            ],
          }
        : {}),
      ...(draft.tecnologias?.length ? { tecnologias: draft.tecnologias } : {}),
      ...(draft.repositorioGithub
        ? { repositorioGithub: draft.repositorioGithub }
        : {}),
      ...(draft.documentacao ? { documentacao: draft.documentacao } : {}),
      status: draft.status === "publicado" ? "concluído" : "em andamento",
      ...(draft.destaque !== undefined ? { destaque: draft.destaque } : {}),
    };
  }

  return {
    ...base,
    imagemCapa: cover,
    ...(draft.categoria?.trim() ? { categoria: draft.categoria.trim() } : {}),
    ...(tags.length ? { tags } : {}),
    resumo: draft.resumo.trim(),
    dataPublicacao: draft.dataPublicacao,
    autor: draft.autores[0]?.trim() ?? "",
    status: draft.status,
  };
}

export function serializeLesson(draft: LessonDraft): string {
  const yaml = stringify(serializeFrontmatter(draft), {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
  return `---\n${yaml}\n---\n\n${serializeBody(draft)}\n`;
}
