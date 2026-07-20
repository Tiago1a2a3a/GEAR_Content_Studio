import { stringify } from "yaml";

import type { ContentBlock, LessonDraft } from "./types";

const contentDirectories = { aula: "aprendizado/aulas", curso: "aprendizado/cursos", trilha: "aprendizado/trilhas", projeto: "projetos", noticia: "noticias" } as const;

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
      const imageDirectory = draft.contentType === "aula" || !draft.contentType ? "aulas" : contentDirectories[draft.contentType];
      return `![${block.alt.trim()}](/images/content/${imageDirectory}/${draft.slug}/${image.normalizedName})`;
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
  if (draft.contentType === "curso") {
    frontmatter.descricao = draft.resumo.trim();
    frontmatter.imagemCapa = banner ? banner.normalizedName : "";
    frontmatter.aulaSlugs = draft.aulaSlugs ?? [];
    if (draft.destaque !== undefined) frontmatter.destaque = draft.destaque;
  } else if (draft.contentType === "trilha") {
    frontmatter.descricaoCurta = draft.resumo.trim();
    if (draft.descricaoLonga?.trim()) frontmatter.descricaoLonga = draft.descricaoLonga.trim();
    frontmatter.imagemCapa = banner ? banner.normalizedName : "";
    frontmatter.area = draft.categoria ?? "geral";
    frontmatter.ordem = 1;
    frontmatter.itens = draft.trilhaItens ?? [];
  } else if (draft.contentType === "projeto") {
    frontmatter.descricaoCurta = draft.resumo.trim();
    if (draft.descricaoLonga?.trim()) frontmatter.descricaoLonga = draft.descricaoLonga.trim();
    if (draft.tecnologias?.length) frontmatter.tecnologias = draft.tecnologias;
    if (draft.destaque !== undefined) frontmatter.destaque = draft.destaque;
    if (draft.documentacao) frontmatter.documentacao = draft.documentacao;
    delete frontmatter.status;
    frontmatter.status = draft.status === "publicado" ? "concluído" : "em andamento";
  } else if (draft.contentType === "noticia") {
    frontmatter.imagemCapa = banner ? banner.normalizedName : "";
    frontmatter.autor = draft.autores[0] ?? "GEAR";
  }

  const yaml = stringify(frontmatter, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
  const body = serializeBody(draft);
  return `---\n${yaml}\n---\n\n${body}\n`;
}
