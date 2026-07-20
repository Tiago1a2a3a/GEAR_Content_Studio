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
  category?: string;
  difficulty?: string;
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
}>;

export type GearContentStudioApi = Readonly<{
  environmentCheck(): Promise<Result<EnvironmentStatus>>;
  configure(
    input: Readonly<{
      remoteUrl: string;
      autoUpdateReferencesOnDelete: boolean;
    }>,
  ): Promise<Result<void>>;
  synchronize(): Promise<Result<Readonly<{ commit: string; indexedEntries: number }>>>;
  listCatalog(filter?: CatalogFilter): Promise<Result<CatalogEntry[]>>;
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
  openExternalHttps(url: string): Promise<Result<void>>;
  copyDiagnostic(detailsId: string): Promise<Result<string>>;
  deletePublished(
    input: Readonly<{ sourcePath: string }>,
  ): Promise<
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
