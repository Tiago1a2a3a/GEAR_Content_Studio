import { z } from "zod";

const nonEmpty = z.string().trim().min(1, "Campo obrigatório.");
const httpsUrl = z
  .string()
  .url("Informe uma URL válida.")
  .refine((value) => new URL(value).protocol === "https:", "Use somente HTTPS.");

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
  }, "Informe uma data existente.");

export const contentBlockSchema = z.discriminatedUnion("kind", [
  z.object({ id: nonEmpty, kind: z.literal("paragraph"), markdown: z.string() }),
  z.object({
    id: nonEmpty,
    kind: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: nonEmpty,
  }),
  z.object({
    id: nonEmpty,
    kind: z.literal("unordered-list"),
    items: z.array(nonEmpty).min(1),
  }),
  z.object({
    id: nonEmpty,
    kind: z.literal("ordered-list"),
    items: z.array(nonEmpty).min(1),
  }),
  z.object({
    id: nonEmpty,
    kind: z.literal("image"),
    imageId: nonEmpty,
    alt: nonEmpty,
  }),
  z.object({
    id: nonEmpty,
    kind: z.literal("code"),
    language: nonEmpty,
    code: nonEmpty,
  }),
  z.object({ id: nonEmpty, kind: z.literal("quote"), markdown: nonEmpty }),
  z.object({ id: nonEmpty, kind: z.literal("separator") }),
]);

export const pendingImageSchema = z.object({
  id: nonEmpty,
  sourcePath: nonEmpty,
  originalName: nonEmpty,
  normalizedName: nonEmpty,
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  bytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const lessonDraftSchema = z.object({
  id: nonEmpty,
  schemaVersion: z.literal(1),
  baseCommit: z.string(),
  slug: slugSchema,
  titulo: nonEmpty,
  bannerImageId: z.string().optional(),
  resumo: nonEmpty,
  tags: z.array(nonEmpty),
  categoria: nonEmpty.optional(),
  dificuldade: z.enum(["iniciante", "intermediário", "avançado"]),
  dataPublicacao: dateSchema,
  dataAtualizacao: dateSchema.optional(),
  autores: z.array(nonEmpty).min(1, "Informe ao menos um autor."),
  preRequisitos: z.array(slugSchema),
  videos: z.array(httpsUrl),
  linksExternos: z.array(z.object({ titulo: nonEmpty, url: httpsUrl })),
  repositorioGithub: httpsUrl.optional(),
  status: z.enum(["rascunho", "publicado"]),
  permiteComentarios: z.boolean(),
  images: z.array(pendingImageSchema),
  body: z.array(contentBlockSchema).min(1, "Adicione conteúdo à Aula."),
  contentType: z.enum(["aula", "curso", "trilha", "projeto", "noticia"]).default("aula"),
});

const localContentBlockSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string(), kind: z.literal("paragraph"), markdown: z.string() }),
  z.object({
    id: z.string(),
    kind: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("unordered-list"),
    items: z.array(z.string()),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("ordered-list"),
    items: z.array(z.string()),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("image"),
    imageId: z.string(),
    alt: z.string(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("code"),
    language: z.string(),
    code: z.string(),
  }),
  z.object({ id: z.string(), kind: z.literal("quote"), markdown: z.string() }),
  z.object({ id: z.string(), kind: z.literal("separator") }),
]);

export const localDraftSchema = lessonDraftSchema.extend({
  slug: z.string(),
  titulo: z.string(),
  resumo: z.string(),
  tags: z.array(z.string()),
  autores: z.array(z.string()),
  preRequisitos: z.array(z.string()),
  videos: z.array(z.string()),
  linksExternos: z.array(z.object({ titulo: z.string(), url: z.string() })),
  repositorioGithub: z.string().optional(),
  dataPublicacao: z.string(),
  dataAtualizacao: z.string().optional(),
  body: z.array(localContentBlockSchema).min(1),
});

export const EXPECTED_REMOTE_URL = "https://github.com/Tiago1a2a3a/Site_Gear";

export const remoteUrlSchema = httpsUrl
  .refine(
    (value) => new URL(value).hostname.toLowerCase() === "github.com",
    "O remoto do MVP deve ser uma URL HTTPS do GitHub.",
  )
  .refine(
    (value) =>
      value
        .replace(/\.git\/?$/i, "")
        .replace(/\/+$/, "")
        .toLowerCase() === EXPECTED_REMOTE_URL.toLowerCase(),
    "Este MVP publica somente no repositório Portal GEAR aprovado.",
  );
