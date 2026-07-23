export type AppError = Readonly<{
  code: string;
  title: string;
  message: string;
  recovery?: string;
  detailsId?: string;
  retryable: boolean;
}>;

export type Result<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: AppError }>;

export type ContentType = "aula" | "curso" | "trilha" | "projeto" | "noticia";

export const DEFAULT_SIDEBAR_ORDER = [
  "inicio",
  "catalogo",
  "nova-aula",
  "rascunhos",
  "tags",
  "categorias",
  "areas",
  "tecnologias",
  "configuracao",
] as const;

export type SidebarItemId = (typeof DEFAULT_SIDEBAR_ORDER)[number];

export type PendingImage = Readonly<{
  id: string;
  sourcePath: string;
  originalName: string;
  normalizedName: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  bytes: number;
  width: number;
  height: number;
}>;

export type PendingDownload = Readonly<{
  id: string;
  sourcePath: string;
  originalName: string;
  normalizedName: string;
  bytes: number;
}>;

export type ContentBlock =
  | Readonly<{ id: string; kind: "paragraph"; markdown: string }>
  | Readonly<{ id: string; kind: "heading"; level: 2 | 3 | 4; text: string }>
  | Readonly<{ id: string; kind: "unordered-list"; items: string[] }>
  | Readonly<{ id: string; kind: "ordered-list"; items: string[] }>
  | Readonly<{ id: string; kind: "image"; imageId: string; alt: string }>
  | Readonly<{ id: string; kind: "code"; language: string; code: string }>
  | Readonly<{ id: string; kind: "video"; titulo: string; url: string }>
  | Readonly<{ id: string; kind: "quote"; markdown: string }>
  | Readonly<{ id: string; kind: "separator" }>;

export type LessonDraft = Readonly<{
  id: string;
  schemaVersion: 1;
  baseCommit: string;
  slug: string;
  titulo: string;
  bannerImageId?: string;
  resumo: string;
  tags: string[];
  categoria?: string;
  dificuldade: "iniciante" | "intermediário" | "avançado";
  dataPublicacao: string;
  dataAtualizacao?: string;
  autores: string[];
  preRequisitos: string[];
  videos: string[];
  linksExternos: ReadonlyArray<Readonly<{ titulo: string; url: string }>>;
  repositorioGithub?: string;
  status: "rascunho" | "publicado";
  permiteComentarios: boolean;
  images: PendingImage[];
  body: ContentBlock[];
  contentType?: ContentType;
  descricaoLonga?: string;
  aulaSlugs?: string[];
  trilhaItens?: Array<Readonly<{ tipo: "curso" | "aula"; slug: string }>>;
  tecnologias?: string[];
  destaque?: boolean;
  documentacao?: string;
  ordem?: number;
  sourcePath?: string;
  existingBannerPath?: string;
  existingImagePaths?: string[];
  downloads?: PendingDownload[];
  existingDownloads?: ReadonlyArray<Readonly<{ titulo: string; arquivo: string }>>;
}>;

export type CatalogEntry = Readonly<{
  type: ContentType;
  slug: string;
  titulo: string;
  status: string;
  summary: string;
  tags: string[];
  tagField?: "tags" | "tecnologias";
  category?: string;
  difficulty?: string;
  publicationDate?: string;
  sourcePath: string;
  outgoingRelations: string[];
  incomingRelations: string[];
  bodyText?: string;
}>;

export type CatalogFilter = Readonly<{
  query?: string;
  type?: ContentType;
  status?: string;
  difficulty?: string;
  category?: string;
  tag?: string;
}>;

export type TagCollectionEntry = Readonly<{
  tag: string;
  usages: number;
  contentPaths: string[];
  types: ContentType[];
}>;

export type TagMutationResult = Readonly<{
  commit: string;
  pushedTo: "origin/main";
  updatedPaths: string[];
}>;

export type CategoryCollectionEntry = Readonly<{
  category: string;
  usages: number;
  contentPaths: string[];
  types: ContentType[];
}>;

export type AreaCollectionEntry = CategoryCollectionEntry;
export type TechnologyCollectionEntry = CategoryCollectionEntry;
export type CategoryMutationResult = TagMutationResult;

export type LocalOperationRecovery = Readonly<{
  preservedPaths: string[];
}>;

export type ValidationIssue = Readonly<{
  severity: "error" | "warning";
  code: string;
  field?: string;
  message: string;
}>;

export type ReviewBundle = Readonly<{
  operationId: string;
  baseCommit: string;
  mdxRelativePath: string;
  imageRelativePaths: string[];
  downloadRelativePaths: string[];
  generatedMdx: string;
  issues: ValidationIssue[];
}>;

export type PublishBundle = Readonly<{
  operationId: string;
  stagedDiff: string;
  stagedPaths: string[];
  commitMessage: string;
  branch: "main";
}>;

export type EnvironmentStatus = Readonly<{
  gitVersion: string;
  userName?: string;
  userEmail?: string;
  configured: boolean;
  repositoryReady: boolean;
  contractCompatible: boolean;
  currentCommit?: string;
  autoUpdateReferencesOnDelete: boolean;
  advancedMode: boolean;
  sidebarOrder: SidebarItemId[];
}>;

export type GearContentStudioApi = Readonly<{
  windowMinimize?(): Promise<void>;
  windowToggleMaximize?(): Promise<boolean>;
  windowClose?(): Promise<void>;
  environmentCheck(): Promise<Result<EnvironmentStatus>>;
  configure(
    input: Readonly<{
      remoteUrl: string;
      autoUpdateReferencesOnDelete: boolean;
      advancedMode: boolean;
      sidebarOrder: SidebarItemId[];
    }>,
  ): Promise<Result<void>>;
  setAdvancedMode(enabled: boolean): Promise<void>;
  synchronize(): Promise<Result<Readonly<{ commit: string; indexedEntries: number }>>>;
  listCatalog(filter?: CatalogFilter): Promise<Result<CatalogEntry[]>>;
  listTags(): Promise<Result<TagCollectionEntry[]>>;
  listCategories(): Promise<Result<CategoryCollectionEntry[]>>;
  listAreas(): Promise<Result<AreaCollectionEntry[]>>;
  listTechnologies(): Promise<Result<TechnologyCollectionEntry[]>>;
  updateTag(
    input: Readonly<{
      tag: string;
      replacement?: string;
      sourcePath?: string;
      enabled?: boolean;
      scope?: "tag" | "technology";
    }>,
  ): Promise<Result<TagMutationResult>>;
  updateCategory(
    input: Readonly<{
      category: string;
      replacement?: string;
      scope?: "category" | "area";
      sourcePath?: string;
      enabled?: boolean;
    }>,
  ): Promise<Result<CategoryMutationResult>>;
  chooseImages(): Promise<Result<PendingImage[]>>;
  chooseDownloads(): Promise<Result<PendingDownload[]>>;
  loadPublished(input: Readonly<{ sourcePath: string }>): Promise<Result<LessonDraft>>;
  saveDraft(draft: LessonDraft): Promise<Result<void>>;
  listDrafts(): Promise<Result<LessonDraft[]>>;
  loadDraft(id: string): Promise<Result<LessonDraft>>;
  deleteDraft(id: string): Promise<Result<void>>;
  prepareReview(draft: LessonDraft): Promise<Result<ReviewBundle>>;
  confirmWrite(operationId: string): Promise<Result<PublishBundle>>;
  confirmPublish(
    operationId: string,
  ): Promise<Result<Readonly<{ commit: string; pushedTo: "origin/main" }>>>;
  cancelOperation(operationId: string): Promise<Result<void>>;
  recoverLocalOperation(): Promise<Result<LocalOperationRecovery>>;
  openExternalHttps(url: string): Promise<Result<void>>;
  copyDiagnostic(detailsId: string): Promise<Result<string>>;
  deletePublished(input: Readonly<{ sourcePath: string }>): Promise<
    Result<
      Readonly<{
        commit: string;
        pushedTo: "origin/main";
        updatedReferences: string[];
      }>
    >
  >;
}>;

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (
  code: string,
  title: string,
  message: string,
  options: Partial<Pick<AppError, "recovery" | "detailsId" | "retryable">> = {},
): Result<never> => ({
  ok: false,
  error: { code, title, message, retryable: false, ...options },
});
