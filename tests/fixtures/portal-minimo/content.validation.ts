import { existsSync, statSync } from "node:fs";
import path from "node:path";

import type { ContentCollections } from "./content.schemas";

type ValidationOptions = Readonly<{ publicDirectory: string }>;

function assertUniqueSlugs(
  entityName: string,
  entries: readonly { slug: string; sourcePath: string }[],
) {
  const sourceBySlug = new Map<string, string>();
  for (const entry of entries) {
    const previousSource = sourceBySlug.get(entry.slug);
    if (previousSource) {
      throw new Error(
        `${entityName} com slug duplicado "${entry.slug}": ${previousSource} e ${entry.sourcePath}.`,
      );
    }
    sourceBySlug.set(entry.slug, entry.sourcePath);
  }
}

function assertPublicFile(
  filePath: string,
  sourcePath: string,
  field: string,
  publicDirectory: string,
) {
  const resolvedPublicDirectory = path.resolve(publicDirectory);
  const resolvedFile = path.resolve(
    resolvedPublicDirectory,
    filePath.replace(/^\/+/, ""),
  );

  if (!resolvedFile.startsWith(`${resolvedPublicDirectory}${path.sep}`)) {
    throw new Error(
      `${sourcePath}: o campo ${field} aponta para fora de public/ (${filePath}).`,
    );
  }
  if (!existsSync(resolvedFile) || !statSync(resolvedFile).isFile()) {
    throw new Error(
      `${sourcePath}: arquivo inexistente em ${field}: ${filePath}.`,
    );
  }
}

function assertReference(
  sourcePath: string,
  field: string,
  slug: string,
  targets: ReadonlySet<string>,
  expectedType: string,
) {
  if (!targets.has(slug)) {
    throw new Error(
      `${sourcePath}: ${field} referencia ${expectedType} inexistente ou não publicado: "${slug}".`,
    );
  }
}

function assertNoPrerequisiteCycle(data: ContentCollections) {
  const lessonSlugs = new Set(data.lessons.map((lesson) => lesson.slug));
  const courseSlugs = new Set(data.courses.map((course) => course.slug));
  const prerequisites = new Map<string, string[]>();

  for (const lesson of data.lessons) {
    prerequisites.set(
      `Aula:${lesson.slug}`,
      (lesson.preRequisitos ?? []).map((slug) => `Aula:${slug}`),
    );
  }
  for (const course of data.courses) {
    prerequisites.set(
      `Curso:${course.slug}`,
      (course.preRequisitos ?? []).map((slug) => {
        if (lessonSlugs.has(slug) && courseSlugs.has(slug)) {
          throw new Error(
            `${course.sourcePath}: preRequisito ambíguo "${slug}" existe como Curso e Aula.`,
          );
        }
        return lessonSlugs.has(slug) ? `Aula:${slug}` : `Curso:${slug}`;
      }),
    );
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(slug: string, trail: readonly string[]) {
    if (visiting.has(slug)) {
      throw new Error(
        `Ciclo de pré-requisitos detectado: ${[...trail, slug].join(" -> ")}.`,
      );
    }
    if (visited.has(slug)) return;

    visiting.add(slug);
    for (const prerequisite of prerequisites.get(slug) ?? []) {
      if (prerequisites.has(prerequisite)) {
        visit(prerequisite, [...trail, slug]);
      }
    }
    visiting.delete(slug);
    visited.add(slug);
  }

  for (const slug of prerequisites.keys()) visit(slug, []);
}

function validateMedia(data: ContentCollections, publicDirectory: string) {
  for (const trail of data.trails) {
    assertPublicFile(
      trail.imagemCapa,
      trail.sourcePath,
      "imagemCapa",
      publicDirectory,
    );
  }
  for (const course of data.courses) {
    assertPublicFile(
      course.imagemCapa,
      course.sourcePath,
      "imagemCapa",
      publicDirectory,
    );
  }
  for (const lesson of data.lessons) {
    if (lesson.banner) {
      assertPublicFile(
        lesson.banner,
        lesson.sourcePath,
        "banner",
        publicDirectory,
      );
    }
    for (const download of lesson.downloads ?? []) {
      assertPublicFile(
        download.arquivo,
        lesson.sourcePath,
        `downloads[${download.titulo}]`,
        publicDirectory,
      );
    }
  }
  for (const project of data.projects) {
    for (const image of project.imagens ?? []) {
      assertPublicFile(image, project.sourcePath, "imagens", publicDirectory);
    }
  }
  for (const article of data.news) {
    assertPublicFile(
      article.imagemCapa,
      article.sourcePath,
      "imagemCapa",
      publicDirectory,
    );
  }
}

export function validateContent(
  data: ContentCollections,
  { publicDirectory }: ValidationOptions,
) {
  assertUniqueSlugs("Trilha", data.trails);
  assertUniqueSlugs("Curso", data.courses);
  assertUniqueSlugs("Aula", data.lessons);
  assertUniqueSlugs("Projeto", data.projects);
  assertUniqueSlugs("Notícia", data.news);

  const allLessons = new Set(data.lessons.map((entry) => entry.slug));
  const allCourses = new Set(data.courses.map((entry) => entry.slug));
  const publishedLessons = new Set(
    data.lessons
      .filter((lesson) => lesson.status === "publicado")
      .map((lesson) => lesson.slug),
  );
  const publishedCourses = new Set(
    data.courses
      .filter((course) => course.status === "publicado")
      .map((course) => course.slug),
  );

  for (const lesson of data.lessons) {
    for (const prerequisite of lesson.preRequisitos ?? []) {
      assertReference(
        lesson.sourcePath,
        "preRequisitos",
        prerequisite,
        allLessons,
        "Aula",
      );
    }
  }

  for (const course of data.courses) {
    if (course.status === "publicado" && course.aulaSlugs.length === 0) {
      throw new Error(
        `${course.sourcePath}: Curso publicado deve conter ao menos uma Aula em aulaSlugs.`,
      );
    }
    for (const lessonSlug of course.aulaSlugs) {
      assertReference(
        course.sourcePath,
        "aulaSlugs",
        lessonSlug,
        course.status === "publicado" ? publishedLessons : allLessons,
        "Aula",
      );
    }
    for (const prerequisite of course.preRequisitos ?? []) {
      const allowedLessons =
        course.status === "publicado" ? publishedLessons : allLessons;
      const allowedCourses =
        course.status === "publicado" ? publishedCourses : allCourses;
      if (
        !allowedLessons.has(prerequisite) &&
        !allowedCourses.has(prerequisite)
      ) {
        throw new Error(
          `${course.sourcePath}: preRequisitos referencia Curso/Aula inexistente ou não publicado: "${prerequisite}".`,
        );
      }
    }
  }

  for (const trail of data.trails) {
    for (const item of trail.itens) {
      const allowedCourses =
        trail.status === "publicado" ? publishedCourses : allCourses;
      const allowedLessons =
        trail.status === "publicado" ? publishedLessons : allLessons;
      assertReference(
        trail.sourcePath,
        "itens",
        item.slug,
        item.tipo === "curso" ? allowedCourses : allowedLessons,
        item.tipo === "curso" ? "Curso" : "Aula",
      );
    }
  }

  assertNoPrerequisiteCycle(data);
  validateMedia(data, publicDirectory);
}

export function prepareContent(data: ContentCollections): ContentCollections {
  const byTitle = <T extends { titulo: string }>(first: T, second: T) =>
    first.titulo.localeCompare(second.titulo, "pt-BR");

  return {
    trails: data.trails
      .filter((entry) => entry.status === "publicado")
      .sort(
        (first, second) => first.ordem - second.ordem || byTitle(first, second),
      ),
    courses: data.courses
      .filter((entry) => entry.status === "publicado")
      .sort(byTitle),
    lessons: data.lessons
      .filter((entry) => entry.status === "publicado")
      .sort(byTitle),
    projects: [...data.projects].sort(byTitle),
    news: data.news
      .filter((entry) => entry.status === "publicado")
      .sort(
        (first, second) =>
          second.dataPublicacao.localeCompare(first.dataPublicacao) ||
          byTitle(first, second),
      ),
  };
}
