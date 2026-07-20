import path from "node:path";

import { defineConfig } from "velite";

import { courses, lessons, news, projects, trails } from "./content.schemas";
import { prepareContent, validateContent } from "./content.validation";

export default defineConfig({
  root: "src/content",
  strict: true,
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    clean: true,
  },
  collections: { trails, courses, lessons, projects, news },
  prepare(data) {
    validateContent(data, {
      publicDirectory: path.resolve(process.cwd(), "public"),
    });

    const prepared = prepareContent(data);
    data.trails.splice(0, data.trails.length, ...prepared.trails);
    data.courses.splice(0, data.courses.length, ...prepared.courses);
    data.lessons.splice(0, data.lessons.length, ...prepared.lessons);
    data.projects.splice(0, data.projects.length, ...prepared.projects);
    data.news.splice(0, data.news.length, ...prepared.news);
  },
});
