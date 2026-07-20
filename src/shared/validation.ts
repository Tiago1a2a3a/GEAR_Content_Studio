import { lessonDraftSchema } from "./schema";
import type { CatalogEntry, LessonDraft, ValidationIssue } from "./types";

const issue = (
  code: string,
  message: string,
  field?: string,
  severity: "error" | "warning" = "error",
): ValidationIssue => ({ severity, code, message, ...(field ? { field } : {}) });

export function hasPrerequisiteCycle(
  lessons: ReadonlyArray<Pick<CatalogEntry, "slug" | "outgoingRelations">>,
  draft?: Pick<LessonDraft, "slug" | "preRequisitos">,
): boolean {
  const graph = new Map(
    lessons.map((lesson) => [lesson.slug, lesson.outgoingRelations]),
  );
  if (draft) graph.set(draft.slug, draft.preRequisitos);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (slug: string): boolean => {
    if (visiting.has(slug)) return true;
    if (visited.has(slug)) return false;
    visiting.add(slug);
    for (const next of graph.get(slug) ?? []) {
      if (graph.has(next) && visit(next)) return true;
    }
    visiting.delete(slug);
    visited.add(slug);
    return false;
  };
  return [...graph.keys()].some(visit);
}

export function validateDraft(
  draft: LessonDraft,
  catalog: readonly CatalogEntry[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = lessonDraftSchema.safeParse(draft);
  if (!parsed.success) {
    for (const problem of parsed.error.issues) {
      issues.push(issue("INVALID_FIELD", problem.message, problem.path.join(".")));
    }
  }

  const type = draft.contentType ?? "aula";
  if (
    catalog.some(
      (entry) =>
        entry.type === type &&
        entry.slug === draft.slug &&
        entry.sourcePath !== draft.sourcePath,
    )
  ) {
    issues.push(
      issue(
        "DUPLICATE_SLUG",
        `Já existe ${type} com este slug. Use outro slug ou um fluxo de atualização.`,
        "slug",
      ),
    );
  }

  if (type === "curso" && !draft.aulaSlugs?.length) {
    issues.push(
      issue(
        "COURSE_LESSONS_REQUIRED",
        "O Curso precisa conter ao menos uma Aula.",
        "aulaSlugs",
      ),
    );
  }
  if (type === "trilha" && !draft.trilhaItens?.length) {
    issues.push(
      issue(
        "TRAIL_ITEMS_REQUIRED",
        "A Trilha precisa conter ao menos um item.",
        "trilhaItens",
      ),
    );
  }
  if (
    ["curso", "trilha", "noticia"].includes(type) &&
    !draft.bannerImageId &&
    !draft.existingBannerPath
  ) {
    issues.push(
      issue(
        "COVER_REQUIRED",
        "Selecione uma imagem de capa para este tipo de conteúdo.",
        "bannerImageId",
      ),
    );
  }
  if (["aula", "noticia"].includes(type) && !draft.autores.length) {
    issues.push(
      issue(
        "AUTHOR_REQUIRED",
        type === "noticia"
          ? "Informe o autor da Notícia."
          : "Informe ao menos um autor da Aula.",
        "autores",
      ),
    );
  }

  const lessons = catalog.filter((entry) => entry.type === "aula");
  for (const lessonSlug of draft.aulaSlugs ?? []) {
    const lesson = lessons.find((entry) => entry.slug === lessonSlug);
    if (!lesson) {
      issues.push(
        issue(
          "MISSING_COURSE_LESSON",
          `Aula inexistente no Curso: ${lessonSlug}.`,
          "aulaSlugs",
        ),
      );
    } else if (draft.status === "publicado" && lesson.status !== "publicado") {
      issues.push(
        issue(
          "DRAFT_COURSE_LESSON",
          `Curso publicado não pode conter a Aula em rascunho ${lessonSlug}.`,
          "aulaSlugs",
        ),
      );
    }
  }
  for (const item of draft.trilhaItens ?? []) {
    const target = catalog.find(
      (entry) => entry.type === item.tipo && entry.slug === item.slug,
    );
    if (!target) {
      issues.push(
        issue(
          "MISSING_TRAIL_ITEM",
          `${item.tipo === "curso" ? "Curso" : "Aula"} inexistente na Trilha: ${item.slug}.`,
          "trilhaItens",
        ),
      );
    } else if (draft.status === "publicado" && target.status !== "publicado") {
      issues.push(
        issue(
          "DRAFT_TRAIL_ITEM",
          `Trilha publicada não pode conter ${item.tipo} em rascunho: ${item.slug}.`,
          "trilhaItens",
        ),
      );
    }
  }

  for (const prerequisite of draft.preRequisitos) {
    const prerequisiteEntry =
      type === "curso"
        ? catalog.find(
            (entry) =>
              (entry.type === "aula" || entry.type === "curso") &&
              entry.slug === prerequisite,
          )
        : lessons.find((entry) => entry.slug === prerequisite);
    if (!prerequisiteEntry) {
      issues.push(
        issue(
          "MISSING_PREREQUISITE",
          `Pré-requisito inexistente: ${prerequisite}.`,
          "preRequisitos",
        ),
      );
    }
    if (draft.status === "publicado" && prerequisiteEntry?.status !== "publicado") {
      issues.push(
        issue(
          "DRAFT_PREREQUISITE",
          `Conteúdo publicado não deve depender do rascunho ${prerequisite}.`,
          "preRequisitos",
        ),
      );
    }
  }
  if (hasPrerequisiteCycle(lessons, draft)) {
    issues.push(
      issue("PREREQUISITE_CYCLE", "Foi detectado um ciclo de pré-requisitos."),
    );
  }

  const imageIds = new Set(draft.images.map((image) => image.id));
  for (const block of draft.body) {
    if (block.kind === "image" && !imageIds.has(block.imageId)) {
      issues.push(
        issue("MISSING_IMAGE", "Um bloco referencia uma imagem ausente.", "body"),
      );
    }
    if (block.kind === "image" && !block.alt.trim()) {
      issues.push(issue("MISSING_ALT", "Texto alternativo é obrigatório.", "body"));
    }
  }
  if (draft.dataPublicacao > new Date().toISOString().slice(0, 10)) {
    issues.push(
      issue(
        "FUTURE_DATE",
        "A data de publicação está no futuro; confirme a intenção.",
        "dataPublicacao",
        "warning",
      ),
    );
  }
  return issues;
}
