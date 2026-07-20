import { defineCollection, s } from "velite";
import type { infer as Infer } from "velite";

const slug = () =>
  s
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use apenas letras minúsculas, números e hífens no slug.",
    );
const nonEmptyText = () => s.string().trim().min(1);
const publicPath = () =>
  s.string().regex(/^\/(?!\/)/, "Use um caminho público absoluto.");
const httpsUrl = () => s.string().url().startsWith("https://");
const isoDate = () =>
  s
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato YYYY-MM-DD.")
    .refine(
      (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      "Use uma data existente.",
    );

const publicationStatus = s.enum(["rascunho", "publicado"]);
const difficulty = s.enum(["iniciante", "intermediário", "avançado"]);
const trailItem = s.discriminatedUnion("tipo", [
  s.object({ tipo: s.literal("curso"), slug: nonEmptyText() }),
  s.object({ tipo: s.literal("aula"), slug: nonEmptyText() }),
]);
const titledUrl = s.object({ titulo: nonEmptyText(), url: httpsUrl() });
const download = s.object({ titulo: nonEmptyText(), arquivo: publicPath() });

export const trailFrontmatterSchema = s.object({
  slug: slug(),
  titulo: nonEmptyText(),
  descricaoCurta: nonEmptyText(),
  descricaoLonga: nonEmptyText().optional(),
  imagemCapa: publicPath(),
  area: nonEmptyText(),
  ordem: s.number().int().nonnegative(),
  dataPublicacao: isoDate().optional(),
  itens: s.array(trailItem).min(1),
  status: publicationStatus,
});
export const trailSchema = trailFrontmatterSchema.extend({
  conteudo: s.mdx(),
  sourcePath: s.path(),
});

export const courseFrontmatterSchema = s.object({
  slug: slug(),
  titulo: nonEmptyText(),
  descricao: nonEmptyText(),
  imagemCapa: publicPath(),
  dataPublicacao: isoDate().optional(),
  destaque: s.boolean().optional(),
  dificuldade: difficulty,
  categoria: nonEmptyText().optional(),
  tags: s.array(nonEmptyText()).optional(),
  preRequisitos: s.array(nonEmptyText()).optional(),
  aulaSlugs: s.array(nonEmptyText()),
  status: publicationStatus,
});
export const courseSchema = courseFrontmatterSchema.extend({
  conteudo: s.mdx(),
  sourcePath: s.path(),
});

export const lessonFrontmatterSchema = s.object({
  slug: slug(),
  titulo: nonEmptyText(),
  banner: publicPath().optional(),
  resumo: nonEmptyText(),
  tags: s.array(nonEmptyText()).optional(),
  categoria: nonEmptyText().optional(),
  dificuldade: difficulty,
  dataPublicacao: isoDate(),
  dataAtualizacao: isoDate().optional(),
  autores: s.array(nonEmptyText()).min(1),
  preRequisitos: s.array(nonEmptyText()).optional(),
  videos: s.array(httpsUrl()).optional(),
  linksExternos: s.array(titledUrl).optional(),
  downloads: s.array(download).optional(),
  repositorioGithub: httpsUrl().optional(),
  status: publicationStatus,
  permiteComentarios: s.boolean().default(false),
});
export const lessonSchema = lessonFrontmatterSchema.extend({
  conteudo: s.mdx(),
  sourcePath: s.path(),
});

export const projectFrontmatterSchema = s.object({
  slug: slug(),
  titulo: nonEmptyText(),
  descricaoCurta: nonEmptyText(),
  descricaoLonga: nonEmptyText().optional(),
  imagens: s.array(publicPath()).optional(),
  videos: s.array(httpsUrl()).optional(),
  tecnologias: s.array(nonEmptyText()).optional(),
  repositorioGithub: httpsUrl().optional(),
  documentacao: httpsUrl().optional(),
  status: s.enum(["em andamento", "concluído"]),
  destaque: s.boolean().optional(),
});
export const projectSchema = projectFrontmatterSchema.extend({
  conteudo: s.mdx(),
  sourcePath: s.path(),
});

export const newsFrontmatterSchema = s.object({
  slug: slug(),
  titulo: nonEmptyText(),
  imagemCapa: publicPath(),
  categoria: nonEmptyText().optional(),
  tags: s.array(nonEmptyText()).optional(),
  resumo: nonEmptyText(),
  dataPublicacao: isoDate(),
  autor: nonEmptyText(),
  status: publicationStatus,
});
export const newsSchema = newsFrontmatterSchema.extend({
  conteudo: s.mdx(),
  sourcePath: s.path(),
});

export const trails = defineCollection({
  name: "Trilha",
  pattern: "aprendizado/trilhas/*.mdx",
  schema: trailSchema,
});
export const courses = defineCollection({
  name: "Curso",
  pattern: "aprendizado/cursos/*.mdx",
  schema: courseSchema,
});
export const lessons = defineCollection({
  name: "Aula",
  pattern: "aprendizado/aulas/*.mdx",
  schema: lessonSchema,
});
export const projects = defineCollection({
  name: "Projeto",
  pattern: "projetos/*.mdx",
  schema: projectSchema,
});
export const news = defineCollection({
  name: "Notícia",
  pattern: "noticias/*.mdx",
  schema: newsSchema,
});

export type Trail = Infer<typeof trailSchema>;
export type Course = Infer<typeof courseSchema>;
export type Lesson = Infer<typeof lessonSchema>;
export type Project = Infer<typeof projectSchema>;
export type News = Infer<typeof newsSchema>;
export type ContentCollections = Readonly<{
  trails: Trail[];
  courses: Course[];
  lessons: Lesson[];
  projects: Project[];
  news: News[];
}>;
