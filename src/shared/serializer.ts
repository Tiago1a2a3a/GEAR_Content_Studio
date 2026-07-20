import { stringify } from "yaml";

import type { ContentBlock, LessonDraft } from "./types";

const unsafeBody = [
  /^\s*import\s/m,
  /^\s*export\s/m,
  /<[A-Z][A-Za-z0-9.]*/,
  /<\/?[a-z][^>]*>/i,
  /<script\b/i,
  /javascript:/i,
];

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
      return `![${block.alt.trim()}](/images/content/aulas/${draft.slug}/${image.normalizedName})`;
    }
    case "code":
      return `\`\`\`${block.language.trim()}\n${block.code.replace(/\s+$/, "")}\n\`\`\``;
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
  const body = draft.body
    .map((block) => {
      const rendered = blockToMdx(block, draft);
      if (
        block.kind !== "code" &&
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
  return body;
}

export function serializeLesson(draft: LessonDraft): string {
  const banner = draft.bannerImageId
    ? draft.images.find((image) => image.id === draft.bannerImageId)
    : undefined;
  if (draft.bannerImageId && !banner)
    throw new Error("Imagem de banner não encontrada.");

  const frontmatter: Record<string, unknown> = {
    slug: draft.slug,
    titulo: draft.titulo.trim(),
  };
  if (banner) {
    frontmatter.banner = `/images/content/aulas/${draft.slug}/${banner.normalizedName}`;
  }
  frontmatter.resumo = draft.resumo.trim();
  if (draft.tags.length) frontmatter.tags = draft.tags.map((value) => value.trim());
  if (draft.categoria?.trim()) frontmatter.categoria = draft.categoria.trim();
  frontmatter.dificuldade = draft.dificuldade;
  frontmatter.dataPublicacao = draft.dataPublicacao;
  if (draft.dataAtualizacao) frontmatter.dataAtualizacao = draft.dataAtualizacao;
  frontmatter.autores = draft.autores.map((value) => value.trim());
  if (draft.preRequisitos.length) frontmatter.preRequisitos = draft.preRequisitos;
  if (draft.videos.length) frontmatter.videos = draft.videos;
  if (draft.linksExternos.length) frontmatter.linksExternos = draft.linksExternos;
  if (draft.repositorioGithub) frontmatter.repositorioGithub = draft.repositorioGithub;
  frontmatter.status = draft.status;
  frontmatter.permiteComentarios = draft.permiteComentarios;

  const yaml = stringify(frontmatter, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
  const body = serializeBody(draft);
  return `---\n${yaml}\n---\n\n${body}\n`;
}
