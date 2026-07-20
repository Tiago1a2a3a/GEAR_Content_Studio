import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CatalogEntry,
  ContentBlock,
  EnvironmentStatus,
  LessonDraft,
  PublishBundle,
  ReviewBundle,
} from "../shared/types";
import { toSlug } from "../shared/slug";
import { EXPECTED_REMOTE_URL } from "../shared/schema";
import { DEFAULT_COVER_PATH } from "../shared/content-defaults";
import { GEAR_LOGO_DATA_URL } from "../shared/brand-assets";

const randomUUID = () => crypto.randomUUID();

type Screen = "inicio" | "catalogo" | "nova-aula" | "rascunhos" | "configuracao";

const today = () => new Date().toISOString().slice(0, 10);

function createDraft(baseCommit = ""): LessonDraft {
  return {
    id: randomUUID(),
    schemaVersion: 1,
    baseCommit,
    slug: "",
    titulo: "",
    resumo: "",
    tags: [],
    dificuldade: "iniciante",
    dataPublicacao: today(),
    autores: [],
    preRequisitos: [],
    videos: [],
    linksExternos: [],
    status: "rascunho",
    permiteComentarios: false,
    images: [],
    body: [{ id: randomUUID(), kind: "paragraph", markdown: "" }],
    contentType: "aula",
  };
}

function fillGptTestCase(
  current: LessonDraft,
  catalog: readonly CatalogEntry[],
): LessonDraft {
  const type = current.contentType ?? "aula";
  const storageKey = `gear-gpt-test-${type}`;
  const number = Number.parseInt(localStorage.getItem(storageKey) ?? "0", 10) + 1;
  localStorage.setItem(storageKey, String(number));
  const suffix = String(number).padStart(3, "0");
  const title = `${type}_gpt_teste_${suffix}`;
  const prioritizeGpt = (entries: CatalogEntry[]) =>
    entries.sort(
      (first, second) =>
        Number(second.slug.includes("gpt-teste")) -
        Number(first.slug.includes("gpt-teste")),
    );
  const publishedLessons = prioritizeGpt(
    catalog.filter((entry) => entry.type === "aula" && entry.status === "publicado"),
  );
  const publishedCourses = prioritizeGpt(
    catalog.filter((entry) => entry.type === "curso" && entry.status === "publicado"),
  );
  return {
    ...current,
    titulo: title,
    slug: toSlug(title),
    resumo: `Caso automatizado ${suffix} para validar todos os campos de ${type}.`,
    descricaoLonga:
      type === "trilha" || type === "projeto"
        ? `Descrição longa do caso GPT ${suffix}, com contexto editorial completo.`
        : undefined,
    tags: ["gpt-teste", type, `teste-${suffix}`],
    categoria: type === "trilha" ? "Testes automatizados" : "Validação GPT",
    dificuldade: "intermediário",
    autores: ["GPT Teste", "Equipe GEAR"],
    preRequisitos:
      type === "aula" && publishedLessons[0] ? [publishedLessons[0].slug] : [],
    aulaSlugs:
      type === "curso"
        ? publishedLessons.slice(0, 2).map((entry) => entry.slug)
        : undefined,
    trilhaItens:
      type === "trilha"
        ? [
            ...(publishedLessons[0]
              ? [{ tipo: "aula" as const, slug: publishedLessons[0].slug }]
              : []),
            ...(publishedCourses[0]
              ? [{ tipo: "curso" as const, slug: publishedCourses[0].slug }]
              : []),
          ]
        : undefined,
    videos:
      type === "aula" || type === "projeto"
        ? ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
        : [],
    linksExternos:
      type === "aula" ? [{ titulo: "Portal UFMG", url: "https://ufmg.br" }] : [],
    repositorioGithub:
      type === "aula" || type === "projeto"
        ? "https://github.com/Tiago1a2a3a/Site_Gear"
        : undefined,
    tecnologias: type === "projeto" ? ["TypeScript", "MDX", "Git"] : undefined,
    documentacao:
      type === "projeto" ? "https://github.com/Tiago1a2a3a/Site_Gear" : undefined,
    destaque: type === "curso" || type === "projeto" ? true : undefined,
    ordem: type === "trilha" ? number : undefined,
    status: "publicado",
    permiteComentarios: type === "aula",
    body: [
      {
        id: randomUUID(),
        kind: "heading",
        level: 2,
        text: `Teste completo ${suffix}`,
      },
      {
        id: randomUUID(),
        kind: "paragraph",
        markdown:
          "Parágrafo com **negrito**, *itálico* e [link HTTPS](https://ufmg.br).",
      },
      {
        id: randomUUID(),
        kind: "unordered-list",
        items: ["Primeiro item", "Segundo item"],
      },
      {
        id: randomUUID(),
        kind: "ordered-list",
        items: ["Primeiro passo", "Segundo passo"],
      },
      {
        id: randomUUID(),
        kind: "code",
        language: "ts",
        code: `const caso = "${type}-${suffix}";`,
      },
      {
        id: randomUUID(),
        kind: "quote",
        markdown: "Caso GPT criado para validar a publicação.",
      },
      { id: randomUUID(), kind: "separator" },
    ],
  };
}

function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="alert error" role="alert" tabIndex={-1}>
      {message}
    </div>
  );
}

const unexpectedErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "A operação falhou sem retornar detalhes. Tente novamente.";

function Home({
  environment,
  catalog,
  onSync,
  onCreate,
  busy,
}: {
  environment?: EnvironmentStatus;
  catalog: CatalogEntry[];
  onSync(): void;
  onCreate(): void;
  busy: boolean;
}) {
  const counts = Object.fromEntries(
    ["aula", "curso", "trilha", "projeto", "noticia"].map((type) => [
      type,
      catalog.filter((entry) => entry.type === type).length,
    ]),
  );
  return (
    <section>
      <div className="hero">
        <div>
          <span className="eyebrow">Visão editorial</span>
          <h1>Conteúdo do Portal, com publicação protegida.</h1>
          <p>Clone gerenciado, validação completa e duas confirmações antes do push.</p>
        </div>
        <button className="primary" onClick={onCreate}>
          Criar novo conteúdo
        </button>
      </div>
      <div className="status-grid">
        <article className="status-card">
          <span>Git</span>
          <strong>{environment?.gitVersion ?? "Verificando…"}</strong>
          <small>
            {environment?.userName && environment?.userEmail
              ? `${environment.userName} • ${environment.userEmail}`
              : "Configure user.name e user.email"}
          </small>
        </article>
        <article className="status-card">
          <span>Clone gerenciado</span>
          <strong>
            {environment?.repositoryReady ? "Pronto" : "Ainda não criado"}
          </strong>
          <small>
            {environment?.currentCommit?.slice(0, 12) ?? "Sem commit local"}
          </small>
        </article>
        <article className="status-card">
          <span>Contrato</span>
          <strong>
            {environment?.repositoryReady
              ? environment.contractCompatible
                ? "Compatível"
                : "Somente leitura"
              : "Aguardando clone"}
          </strong>
          <small>Hashes do Portal são verificados antes de publicar.</small>
        </article>
      </div>
      <div className="toolbar">
        <button onClick={onSync} disabled={busy}>
          {busy ? "Sincronizando…" : "Sincronizar agora"}
        </button>
      </div>
      <div className="count-grid">
        {Object.entries(counts).map(([type, count]) => (
          <article className="count-card" key={type}>
            <strong>{count}</strong>
            <span>{type}s</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Catalog({
  entries,
  onDelete,
  onEdit,
}: {
  entries: CatalogEntry[];
  onDelete(entry: CatalogEntry): Promise<boolean>;
  onEdit(entry: CatalogEntry): Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<CatalogEntry>();
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (
      selected &&
      !entries.some((entry) => entry.sourcePath === selected.sourcePath)
    ) {
      setSelected(undefined);
    }
  }, [entries, selected]);
  const visible = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    return entries.filter(
      (entry) =>
        (!type || entry.type === type) &&
        (!normalized ||
          [entry.titulo, entry.slug, entry.summary, ...entry.tags]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(normalized)),
    );
  }, [entries, query, type]);
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Somente leitura</span>
          <h1>Catálogo</h1>
        </div>
        <span>{visible.length} itens</span>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <label>
            Buscar
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Título, slug ou tag"
            />
          </label>
          <label>
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Todos</option>
              <option value="aula">Aula</option>
              <option value="curso">Curso</option>
              <option value="trilha">Trilha</option>
              <option value="projeto">Projeto</option>
              <option value="noticia">Notícia</option>
            </select>
          </label>
        </aside>
        <div className="catalog-list">
          {visible.map((entry) => (
            <button
              className="catalog-item"
              key={entry.sourcePath}
              onClick={() => setSelected(entry)}
            >
              <span className={`badge ${entry.type}`}>{entry.type}</span>
              <strong>{entry.titulo}</strong>
              <small>
                {entry.status} {entry.difficulty ? `• ${entry.difficulty}` : ""}
              </small>
              <p>{entry.summary}</p>
            </button>
          ))}
          {!visible.length && <div className="empty">Nenhum conteúdo encontrado.</div>}
        </div>
        <aside className="detail">
          {selected ? (
            <>
              <span className={`badge ${selected.type}`}>{selected.type}</span>
              <h2>{selected.titulo}</h2>
              <code>{selected.slug}</code>
              <p>{selected.summary}</p>
              <dl>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
                <dt>Origem</dt>
                <dd>{selected.sourcePath}</dd>
                <dt>Depende de</dt>
                <dd>
                  {selected.outgoingRelations.length ? (
                    <ul className="relations">
                      {selected.outgoingRelations.map((relation) => (
                        <li key={relation}>{relation}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Usado por</dt>
                <dd>
                  {selected.incomingRelations.length ? (
                    <ul className="relations">
                      {selected.incomingRelations.map((relation) => (
                        <li key={relation}>{relation}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
              <button
                className="danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    if (await onDelete(selected)) setSelected(undefined);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Excluindo…" : "Excluir publicado"}
              </button>
              <button disabled={deleting} onClick={() => void onEdit(selected)}>
                Editar conteúdo
              </button>
            </>
          ) : (
            <div className="empty">Selecione um conteúdo para ver detalhes.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

function BlockEditor({
  blocks,
  images,
  onChange,
}: {
  blocks: ContentBlock[];
  images: LessonDraft["images"];
  onChange(blocks: ContentBlock[]): void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number>();
  const add = (kind: ContentBlock["kind"]) => {
    const id = randomUUID();
    const block: ContentBlock =
      kind === "heading"
        ? { id, kind, level: 2, text: "" }
        : kind === "unordered-list"
          ? { id, kind, items: [""] }
          : kind === "ordered-list"
            ? { id, kind, items: [""] }
            : kind === "code"
              ? { id, kind, language: "text", code: "" }
              : kind === "quote"
                ? { id, kind, markdown: "" }
                : kind === "image"
                  ? { id, kind, imageId: images[0]?.id ?? "", alt: "" }
                  : kind === "separator"
                    ? { id, kind }
                    : { id, kind: "paragraph", markdown: "" };
    onChange([...blocks, block]);
  };
  const update = (index: number, block: ContentBlock) =>
    onChange(
      blocks.map((current, currentIndex) => (currentIndex === index ? block : current)),
    );
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div>
      <div className="block-toolbar">
        {(
          [
            "paragraph",
            "heading",
            "unordered-list",
            "ordered-list",
            "image",
            "code",
            "quote",
            "separator",
          ] as const
        ).map((kind) => (
          <button type="button" key={kind} onClick={() => add(kind)}>
            + {kind}
          </button>
        ))}
      </div>
      <div className="blocks">
        {blocks.map((block, index) => (
          <article
            className="block"
            key={block.id}
            draggable
            onDragStart={() => setDraggedIndex(index)}
            onDragEnd={() => setDraggedIndex(undefined)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedIndex === undefined || draggedIndex === index) return;
              const next = [...blocks];
              const [moved] = next.splice(draggedIndex, 1);
              if (!moved) return;
              next.splice(index, 0, moved);
              setDraggedIndex(undefined);
              onChange(next);
            }}
          >
            <header>
              <strong title="Arraste para reordenar">⠿ {block.kind}</strong>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    onChange([
                      ...blocks.slice(0, index + 1),
                      { ...block, id: randomUUID() },
                      ...blocks.slice(index + 1),
                    ])
                  }
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  aria-label="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  aria-label="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remover este bloco?")) {
                      onChange(
                        blocks.filter((_, currentIndex) => currentIndex !== index),
                      );
                    }
                  }}
                >
                  Remover
                </button>
              </div>
            </header>
            {block.kind === "paragraph" || block.kind === "quote" ? (
              <textarea
                value={block.markdown}
                onChange={(event) =>
                  update(index, { ...block, markdown: event.target.value })
                }
              />
            ) : block.kind === "heading" ? (
              <div className="inline">
                <select
                  value={block.level}
                  onChange={(event) =>
                    update(index, {
                      ...block,
                      level: Number(event.target.value) as 2 | 3 | 4,
                    })
                  }
                >
                  <option value="2">H2</option>
                  <option value="3">H3</option>
                  <option value="4">H4</option>
                </select>
                <input
                  value={block.text}
                  onChange={(event) =>
                    update(index, { ...block, text: event.target.value })
                  }
                />
              </div>
            ) : block.kind === "unordered-list" || block.kind === "ordered-list" ? (
              <textarea
                value={block.items.join("\n")}
                onChange={(event) =>
                  update(index, { ...block, items: event.target.value.split("\n") })
                }
                placeholder="Um item por linha"
              />
            ) : block.kind === "code" ? (
              <>
                <input
                  value={block.language}
                  onChange={(event) =>
                    update(index, { ...block, language: event.target.value })
                  }
                  placeholder="Linguagem"
                />
                <textarea
                  className="code-input"
                  value={block.code}
                  onChange={(event) =>
                    update(index, { ...block, code: event.target.value })
                  }
                />
              </>
            ) : block.kind === "image" ? (
              <div className="inline">
                <select
                  value={block.imageId}
                  onChange={(event) =>
                    update(index, { ...block, imageId: event.target.value })
                  }
                >
                  <option value="">Selecione uma imagem</option>
                  {images.map((image) => (
                    <option key={image.id} value={image.id}>
                      {image.normalizedName}
                    </option>
                  ))}
                </select>
                <input
                  value={block.alt}
                  onChange={(event) =>
                    update(index, { ...block, alt: event.target.value })
                  }
                  placeholder="Texto alternativo obrigatório"
                />
              </div>
            ) : (
              <hr />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function LessonEditor({
  initialDraft,
  catalog,
  onSaved,
  onDraftChange,
}: {
  initialDraft: LessonDraft;
  catalog: CatalogEntry[];
  onSaved(draftId: string, commit: string): void;
  onDraftChange(draft: LessonDraft): void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewBundle>();
  const [publish, setPublish] = useState<PublishBundle>();
  const [publishedCommit, setPublishedCommit] = useState("");
  const autoSlug = useRef(initialDraft.slug === toSlug(initialDraft.titulo));
  const published = useRef(false);
  const set = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) => {
    setReview(undefined);
    setPublish(undefined);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    onDraftChange(draft);
    const save = () => {
      if (!published.current) void window.gearContentStudio.saveDraft(draft);
    };
    const timer = window.setTimeout(save, 750);
    window.addEventListener("beforeunload", save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, [draft, onDraftChange]);

  const lessons = catalog.filter((entry) => entry.type === "aula");
  const courses = catalog.filter((entry) => entry.type === "curso");
  const prepare = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await window.gearContentStudio.prepareReview(draft);
      if (!result.ok) return setError(`${result.error.title}: ${result.error.message}`);
      setReview(result.value);
    } catch (caught) {
      setError(`Não foi possível validar: ${unexpectedErrorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  };
  const write = async () => {
    if (
      !review ||
      !window.confirm("Confirmar escrita dos arquivos listados no clone gerenciado?")
    )
      return;
    setBusy(true);
    try {
      const result = await window.gearContentStudio.confirmWrite(review.operationId);
      if (!result.ok) return setError(`${result.error.title}: ${result.error.message}`);
      setPublish(result.value);
    } catch (caught) {
      setError(`Não foi possível preparar: ${unexpectedErrorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  };
  const publishNow = async () => {
    if (
      !publish ||
      !window.confirm(
        `Publicar em origin/main com a mensagem:\n${publish.commitMessage}\n\nEsta é a segunda confirmação.`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await window.gearContentStudio.confirmPublish(publish.operationId);
      if (!result.ok) return setError(`${result.error.title}: ${result.error.message}`);
      published.current = true;
      setPublishedCommit(result.value.commit);
      onSaved(draft.id, result.value.commit);
    } catch (caught) {
      setError(`Não foi possível publicar: ${unexpectedErrorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {draft.sourcePath ? "Editar conteúdo" : "Novo conteúdo"} • etapa {step} de 4
          </span>
          <h1>
            {
              ["Informações", "Conteúdo", "Recursos e relações", "Revisar e publicar"][
                step - 1
              ]
            }
          </h1>
        </div>
        <div>
          <span>Rascunho salvo automaticamente</span>
          <button
            type="button"
            disabled={Boolean(draft.sourcePath)}
            onClick={() => {
              autoSlug.current = false;
              setReview(undefined);
              setPublish(undefined);
              setDraft((current) => fillGptTestCase(current, catalog));
            }}
          >
            Preencher caso GPT
          </button>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="steps">
        {[1, 2, 3, 4].map((value) => (
          <button
            key={value}
            className={step === value ? "active" : ""}
            onClick={() => setStep(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {step === 1 && (
        <div className="form-grid">
          <label>
            Tipo de conteúdo
            <select
              value={draft.contentType}
              onChange={(event) =>
                set("contentType", event.target.value as LessonDraft["contentType"])
              }
            >
              <option value="aula">Aula</option>
              <option value="curso">Curso</option>
              <option value="trilha">Trilha</option>
              <option value="noticia">Notícia</option>
              <option value="projeto">Projeto</option>
            </select>
          </label>
          {(draft.contentType === "trilha" || draft.contentType === "projeto") && (
            <label className="wide">
              Descrição longa, opcional
              <textarea
                value={draft.descricaoLonga ?? ""}
                onChange={(event) => set("descricaoLonga", event.target.value)}
              />
            </label>
          )}
          {draft.contentType === "trilha" && (
            <label>
              Ordem editorial
              <input
                type="number"
                min={0}
                value={draft.ordem ?? 1}
                onChange={(event) => set("ordem", Number(event.target.value))}
              />
            </label>
          )}
          {draft.contentType === "projeto" && (
            <>
              <label>
                Tecnologias, separadas por vírgula
                <input
                  value={(draft.tecnologias ?? []).join(", ")}
                  onChange={(event) =>
                    set(
                      "tecnologias",
                      event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label>
                Documentação HTTPS
                <input
                  value={draft.documentacao ?? ""}
                  onChange={(event) =>
                    set("documentacao", event.target.value || undefined)
                  }
                />
              </label>
            </>
          )}
          {(draft.contentType === "curso" || draft.contentType === "projeto") && (
            <label className="check">
              <input
                type="checkbox"
                checked={draft.destaque ?? false}
                onChange={(event) => set("destaque", event.target.checked)}
              />
              Conteúdo em destaque
            </label>
          )}
          <label className="wide">
            Título
            <input
              value={draft.titulo}
              onChange={(event) => {
                const titulo = event.target.value;
                setDraft((current) => ({
                  ...current,
                  titulo,
                  slug: autoSlug.current ? toSlug(titulo) : current.slug,
                }));
              }}
            />
          </label>
          <label>
            Slug
            <input
              value={draft.slug}
              disabled={Boolean(draft.sourcePath)}
              onChange={(event) => {
                autoSlug.current = false;
                set("slug", toSlug(event.target.value));
              }}
            />
          </label>
          {draft.contentType !== "projeto" && (
            <label>
              Data de publicação
              <input
                type="date"
                value={draft.dataPublicacao}
                onChange={(event) => set("dataPublicacao", event.target.value)}
              />
            </label>
          )}
          {(draft.contentType === "aula" || !draft.contentType) && (
            <label>
              Data de atualização, opcional
              <input
                type="date"
                value={draft.dataAtualizacao ?? ""}
                onChange={(event) =>
                  set("dataAtualizacao", event.target.value || undefined)
                }
              />
            </label>
          )}
          <label className="wide">
            Resumo
            <textarea
              value={draft.resumo}
              onChange={(event) => set("resumo", event.target.value)}
            />
          </label>
          {draft.contentType !== "projeto" && (
            <label>
              {draft.contentType === "trilha" ? "Área" : "Categoria"}
              <input
                value={draft.categoria ?? ""}
                onChange={(event) => set("categoria", event.target.value || undefined)}
              />
            </label>
          )}
          {(draft.contentType === "aula" ||
            draft.contentType === "curso" ||
            !draft.contentType) && (
            <label>
              Dificuldade
              <select
                value={draft.dificuldade}
                onChange={(event) =>
                  set("dificuldade", event.target.value as LessonDraft["dificuldade"])
                }
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermediário">Intermediário</option>
                <option value="avançado">Avançado</option>
              </select>
            </label>
          )}
          {["aula", "curso", "noticia"].includes(draft.contentType ?? "aula") && (
            <label>
              Tags, separadas por vírgula
              <input
                value={draft.tags.join(", ")}
                onChange={(event) =>
                  set(
                    "tags",
                    event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          )}
          {(draft.contentType === "aula" ||
            draft.contentType === "noticia" ||
            !draft.contentType) && (
            <label>
              {draft.contentType === "noticia"
                ? "Autor"
                : "Autores, separados por vírgula"}
              <input
                value={draft.autores.join(", ")}
                onChange={(event) =>
                  set(
                    "autores",
                    event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          )}
          <label>
            Status
            <select
              value={draft.status}
              onChange={(event) =>
                set("status", event.target.value as LessonDraft["status"])
              }
            >
              <option value="rascunho">
                {draft.contentType === "projeto" ? "Em andamento" : "Rascunho"}
              </option>
              <option value="publicado">
                {draft.contentType === "projeto" ? "Concluído" : "Publicado"}
              </option>
            </select>
          </label>
          {(draft.contentType === "aula" || !draft.contentType) && (
            <label className="check">
              <input
                type="checkbox"
                checked={draft.permiteComentarios}
                onChange={(event) => set("permiteComentarios", event.target.checked)}
              />
              Permitir comentários
            </label>
          )}
        </div>
      )}
      {step === 2 && (
        <BlockEditor
          blocks={[...draft.body]}
          images={draft.images}
          onChange={(blocks) => set("body", blocks)}
        />
      )}
      {step === 3 && (
        <div className="form-grid">
          {draft.contentType === "curso" && (
            <fieldset className="wide">
              <legend>Aulas do Curso</legend>
              <div className="choice-grid">
                {lessons.map((lesson) => (
                  <label className="check" key={lesson.slug}>
                    <input
                      type="checkbox"
                      checked={(draft.aulaSlugs ?? []).includes(lesson.slug)}
                      disabled={
                        draft.status === "publicado" && lesson.status !== "publicado"
                      }
                      onChange={(event) =>
                        set(
                          "aulaSlugs",
                          event.target.checked
                            ? [...(draft.aulaSlugs ?? []), lesson.slug]
                            : (draft.aulaSlugs ?? []).filter(
                                (slug) => slug !== lesson.slug,
                              ),
                        )
                      }
                    />
                    {lesson.titulo} <small>({lesson.status})</small>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {draft.contentType === "trilha" && (
            <fieldset className="wide">
              <legend>Itens da Trilha, na ordem de seleção</legend>
              <div className="choice-grid">
                {[...lessons, ...courses].map((entry) => {
                  const selectedItem = (draft.trilhaItens ?? []).some(
                    (item) => item.tipo === entry.type && item.slug === entry.slug,
                  );
                  return (
                    <label className="check" key={`${entry.type}:${entry.slug}`}>
                      <input
                        type="checkbox"
                        checked={selectedItem}
                        disabled={
                          draft.status === "publicado" && entry.status !== "publicado"
                        }
                        onChange={(event) =>
                          set(
                            "trilhaItens",
                            event.target.checked
                              ? [
                                  ...(draft.trilhaItens ?? []),
                                  {
                                    tipo: entry.type as "aula" | "curso",
                                    slug: entry.slug,
                                  },
                                ]
                              : (draft.trilhaItens ?? []).filter(
                                  (item) =>
                                    !(
                                      item.tipo === entry.type &&
                                      item.slug === entry.slug
                                    ),
                                ),
                          )
                        }
                      />
                      {entry.type}: {entry.titulo} <small>({entry.status})</small>
                    </label>
                  );
                })}
              </div>
              {(draft.trilhaItens ?? []).length > 0 && (
                <ol>
                  {(draft.trilhaItens ?? []).map((item, index) => (
                    <li key={`${item.tipo}:${item.slug}`}>
                      {item.tipo}: {item.slug}{" "}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...(draft.trilhaItens ?? [])];
                          [next[index - 1], next[index]] = [
                            next[index]!,
                            next[index - 1]!,
                          ];
                          set("trilhaItens", next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === (draft.trilhaItens?.length ?? 0) - 1}
                        onClick={() => {
                          const next = [...(draft.trilhaItens ?? [])];
                          [next[index], next[index + 1]] = [
                            next[index + 1]!,
                            next[index]!,
                          ];
                          set("trilhaItens", next);
                        }}
                      >
                        ↓
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </fieldset>
          )}
          {(draft.contentType === "aula" ||
            draft.contentType === "curso" ||
            !draft.contentType) && (
            <fieldset className="wide">
              <legend>Pré-requisitos</legend>
              <div className="choice-grid">
                {(draft.contentType === "curso" ? [...lessons, ...courses] : lessons)
                  .filter((entry) => entry.slug !== draft.slug)
                  .map((lesson) => (
                    <label className="check" key={lesson.slug}>
                      <input
                        type="checkbox"
                        checked={draft.preRequisitos.includes(lesson.slug)}
                        disabled={
                          draft.status === "publicado" && lesson.status !== "publicado"
                        }
                        onChange={(event) =>
                          set(
                            "preRequisitos",
                            event.target.checked
                              ? [...draft.preRequisitos, lesson.slug]
                              : draft.preRequisitos.filter(
                                  (slug) => slug !== lesson.slug,
                                ),
                          )
                        }
                      />
                      {lesson.titulo} <small>({lesson.status})</small>
                    </label>
                  ))}
              </div>
            </fieldset>
          )}
          {(draft.contentType === "aula" ||
            draft.contentType === "projeto" ||
            !draft.contentType) && (
            <label className="wide">
              Vídeos HTTPS, um por linha
              <textarea
                value={draft.videos.join("\n")}
                onChange={(event) =>
                  set(
                    "videos",
                    event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
              <small>Vídeos aparecem em Recursos da aula, após o conteúdo.</small>
            </label>
          )}
          {(draft.contentType === "aula" || !draft.contentType) && (
            <label className="wide">
              Links externos, um por linha no formato título | URL HTTPS
              <textarea
                value={draft.linksExternos
                  .map((link) => `${link.titulo} | ${link.url}`)
                  .join("\n")}
                onChange={(event) =>
                  set(
                    "linksExternos",
                    event.target.value
                      .split("\n")
                      .map((line) => {
                        const [titulo, ...urlParts] = line.split("|");
                        return {
                          titulo: titulo?.trim() ?? "",
                          url: urlParts.join("|").trim(),
                        };
                      })
                      .filter((link) => link.titulo || link.url),
                  )
                }
              />
            </label>
          )}
          {(draft.contentType === "aula" || !draft.contentType) && (
            <div className="wide">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await window.gearContentStudio.chooseDownloads();
                    if (result.ok) {
                      set("downloads", [...(draft.downloads ?? []), ...result.value]);
                    } else {
                      setError(result.error.message);
                    }
                  } catch (caught) {
                    setError(
                      `Não foi possível selecionar downloads: ${unexpectedErrorMessage(caught)}`,
                    );
                  }
                }}
              >
                Selecionar downloads
              </button>
              <ul>
                {(draft.existingDownloads ?? []).map((download) => (
                  <li key={download.arquivo}>{download.titulo} (existente)</li>
                ))}
                {(draft.downloads ?? []).map((download) => (
                  <li key={download.id}>
                    {download.normalizedName} • {Math.round(download.bytes / 1024)} KiB
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(draft.contentType === "aula" ||
            draft.contentType === "projeto" ||
            !draft.contentType) && (
            <label className="wide">
              Repositório GitHub
              <input
                value={draft.repositorioGithub ?? ""}
                onChange={(event) =>
                  set("repositorioGithub", event.target.value || undefined)
                }
              />
            </label>
          )}
          <div className="wide">
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await window.gearContentStudio.chooseImages();
                  if (result.ok) {
                    setDraft((current) => {
                      const first = result.value[0];
                      const isGptCase = current.titulo.includes("_gpt_teste_");
                      return {
                        ...current,
                        images: [...current.images, ...result.value],
                        bannerImageId:
                          current.bannerImageId ??
                          (["curso", "trilha", "noticia"].includes(
                            current.contentType ?? "aula",
                          )
                            ? first?.id
                            : undefined),
                        body:
                          isGptCase &&
                          first &&
                          !current.body.some((block) => block.kind === "image")
                            ? [
                                ...current.body,
                                {
                                  id: randomUUID(),
                                  kind: "image" as const,
                                  imageId: first.id,
                                  alt: `Imagem do ${current.titulo}`,
                                },
                              ]
                            : current.body,
                      };
                    });
                  } else setError(result.error.message);
                } catch (caught) {
                  setError(
                    `Não foi possível selecionar imagens: ${unexpectedErrorMessage(caught)}`,
                  );
                }
              }}
            >
              Selecionar imagens
            </button>
            <ul>
              {draft.images.map((image) => (
                <li key={image.id}>
                  {image.normalizedName} • {image.width}×{image.height} •{" "}
                  {Math.round(image.bytes / 1024)} KiB
                </li>
              ))}
            </ul>
            {draft.contentType !== "projeto" && (
              <p className="hint">
                Sem uma imagem escolhida, será usada automaticamente a capa branca
                pública <code>{DEFAULT_COVER_PATH}</code>.
              </p>
            )}
            {draft.images.length > 0 && (
              <label>
                {["curso", "trilha", "noticia"].includes(draft.contentType ?? "aula")
                  ? "Imagem de capa"
                  : draft.contentType === "projeto"
                    ? "Imagem principal"
                    : "Banner opcional"}
                <select
                  value={draft.bannerImageId ?? ""}
                  onChange={(event) =>
                    set("bannerImageId", event.target.value || undefined)
                  }
                >
                  <option value="">Usar capa branca padrão</option>
                  {draft.images.map((image) => (
                    <option key={image.id} value={image.id}>
                      {image.normalizedName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="review-grid">
          <article className="panel">
            <h2>Preview estrutural</h2>
            <h1>{draft.titulo || "Título da Aula"}</h1>
            <p>{draft.resumo}</p>
            {draft.body.map((block) => (
              <div key={block.id} className="preview-block">
                {block.kind === "heading" ? (
                  <strong>{block.text}</strong>
                ) : block.kind === "paragraph" || block.kind === "quote" ? (
                  <p>{block.markdown}</p>
                ) : block.kind === "code" ? (
                  <pre>{block.code}</pre>
                ) : block.kind === "unordered-list" || block.kind === "ordered-list" ? (
                  <ul>
                    {block.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : block.kind === "separator" ? (
                  <hr />
                ) : (
                  <span>Imagem: {block.alt}</span>
                )}
              </div>
            ))}
          </article>
          <article className="panel">
            <h2>Revisão técnica</h2>
            {!review && (
              <button className="primary" disabled={busy} onClick={prepare}>
                {busy ? "Validando…" : "Gerar MDX e revisar"}
              </button>
            )}
            {review && (
              <>
                <h3>Arquivos</h3>
                <code>{review.mdxRelativePath}</code>
                {review.imageRelativePaths.map((item) => (
                  <code key={item}>{item}</code>
                ))}
                {review.downloadRelativePaths.map((item) => (
                  <code key={item}>{item}</code>
                ))}
                <h3>MDX</h3>
                <pre className="mdx">{review.generatedMdx}</pre>
                {review.issues.map((item) => (
                  <p
                    className={`issue ${item.severity}`}
                    key={`${item.code}-${item.field}`}
                  >
                    {item.message}
                  </p>
                ))}
                {!publish && (
                  <button className="primary" disabled={busy} onClick={write}>
                    Preparar alterações
                  </button>
                )}
              </>
            )}
            {publish && (
              <>
                <h3>Diff staged</h3>
                <pre className="mdx">{publish.stagedDiff}</pre>
                <p>
                  <strong>{publish.commitMessage}</strong>
                </p>
                <button className="danger" disabled={busy} onClick={publishNow}>
                  Publicar no GitHub
                </button>
              </>
            )}
            {publishedCommit && (
              <div className="alert success">Publicado: {publishedCommit}</div>
            )}
          </article>
        </div>
      )}
      <div className="wizard-actions">
        <button disabled={step === 1} onClick={() => setStep((value) => value - 1)}>
          Voltar
        </button>
        <button disabled={step === 4} onClick={() => setStep((value) => value + 1)}>
          Continuar
        </button>
      </div>
    </section>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [environment, setEnvironment] = useState<EnvironmentStatus>();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [drafts, setDrafts] = useState<LessonDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<LessonDraft>();
  const [remoteUrl, setRemoteUrl] = useState(EXPECTED_REMOTE_URL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    const [environmentResult, catalogResult, draftsResult] = await Promise.all([
      window.gearContentStudio.environmentCheck(),
      window.gearContentStudio.listCatalog(),
      window.gearContentStudio.listDrafts(),
    ]);
    if (environmentResult.ok) setEnvironment(environmentResult.value);
    if (catalogResult.ok) setCatalog(catalogResult.value);
    if (draftsResult.ok) {
      setDrafts((current) => {
        const merged = new Map(
          draftsResult.value.map((draft) => [draft.id, draft] as const),
        );
        for (const draft of current) merged.set(draft.id, draft);
        return [...merged.values()];
      });
    }
  };
  useEffect(() => void refresh(), []);

  const synchronize = async () => {
    setBusy(true);
    setError("");
    const result = await window.gearContentStudio.synchronize();
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    await refresh();
  };
  const createNew = () => {
    setActiveDraft(createDraft(environment?.currentCommit));
    setScreen("nova-aula");
  };
  const updateActiveDraft = useCallback((draft: LessonDraft) => {
    setActiveDraft(draft);
    setDrafts((current) =>
      draft.titulo.trim()
        ? [draft, ...current.filter((item) => item.id !== draft.id)]
        : current.filter((item) => item.id !== draft.id),
    );
  }, []);
  return (
    <div className="shell">
      <header className="topbar">
        <img className="brand-logo" src={GEAR_LOGO_DATA_URL} alt="GEAR" />
        <div>
          <strong>GEAR Content Studio</strong>
          <small>
            {environment?.repositoryReady
              ? `main • ${environment.currentCommit?.slice(0, 8)}`
              : "Configuração local"}
          </small>
        </div>
        <span className="connection">
          <i className={environment?.configured ? "online" : ""} />
          {environment?.configured ? "Git configurado" : "Configuração necessária"}
        </span>
      </header>
      <aside className="sidebar">
        {(
          [
            ["inicio", "Início"],
            ["catalogo", "Catálogo"],
            ["nova-aula", "Novo conteúdo"],
            ["rascunhos", "Rascunhos"],
            ["configuracao", "Configurações"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={screen === value ? "active" : ""}
            onClick={() => (value === "nova-aula" ? createNew() : setScreen(value))}
          >
            {label}
          </button>
        ))}
      </aside>
      <main>
        <ErrorMessage message={error} />
        {notice && (
          <div className="alert success" role="status">
            {notice}
            <button
              type="button"
              onClick={() => {
                setNotice("");
                void window.gearContentStudio.openExternalHttps(
                  "https://github.com/Tiago1a2a3a/Site_Gear/actions",
                );
              }}
            >
              Ver deploy no GitHub
            </button>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {screen === "inicio" && (
          <Home
            environment={environment}
            catalog={catalog}
            onSync={synchronize}
            onCreate={createNew}
            busy={busy}
          />
        )}
        {screen === "catalogo" && (
          <Catalog
            entries={catalog}
            onEdit={async (entry) => {
              setBusy(true);
              setError("");
              try {
                const result = await window.gearContentStudio.loadPublished({
                  sourcePath: entry.sourcePath,
                });
                if (!result.ok) {
                  setError(`${result.error.title}: ${result.error.message}`);
                  return;
                }
                setActiveDraft(result.value);
                setScreen("nova-aula");
              } catch (caught) {
                setError(
                  `Não foi possível carregar: ${unexpectedErrorMessage(caught)}`,
                );
              } finally {
                setBusy(false);
              }
            }}
            onDelete={async (entry) => {
              if (
                !window.confirm(
                  `Excluir ${entry.sourcePath}? Esta ação removerá o MDX do GitHub.`,
                )
              )
                return false;
              if (
                !window.confirm(
                  `Confirma novamente a exclusão de ${entry.slug}? Dependências existentes bloquearão a operação.`,
                )
              )
                return false;
              setBusy(true);
              try {
                const result = await window.gearContentStudio.deletePublished({
                  sourcePath: entry.sourcePath,
                });
                if (!result.ok) {
                  setError(`${result.error.title}: ${result.error.message}`);
                  return false;
                }
                setCatalog((current) =>
                  current.filter(
                    (candidate) => candidate.sourcePath !== entry.sourcePath,
                  ),
                );
                setError("");
                setNotice(
                  `Exclusão confirmada em origin/main (${result.value.commit.slice(0, 8)}). O site será atualizado pelo deploy do Portal.`,
                );
                await refresh();
                return true;
              } catch (caught) {
                setError(`Não foi possível excluir: ${unexpectedErrorMessage(caught)}`);
                return false;
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {screen === "nova-aula" && activeDraft && (
          <LessonEditor
            key={activeDraft.id}
            initialDraft={activeDraft}
            catalog={catalog}
            onSaved={(draftId, commit) => {
              setDrafts((current) => current.filter((draft) => draft.id !== draftId));
              setActiveDraft(undefined);
              setScreen("catalogo");
              setNotice(
                `Publicação confirmada em origin/main (${commit.slice(0, 8)}). Acompanhe o deploy antes de validar o site.`,
              );
              void refresh();
            }}
            onDraftChange={updateActiveDraft}
          />
        )}
        {screen === "rascunhos" && (
          <section>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Recuperação local</span>
                <h1>Rascunhos</h1>
              </div>
            </div>
            <div className="draft-list">
              {drafts.map((draft) => (
                <article className="panel" key={draft.id}>
                  <h2>{draft.titulo || "Conteúdo sem título"}</h2>
                  <code>{draft.slug || draft.id}</code>
                  <div className="toolbar">
                    <button
                      onClick={() => {
                        setActiveDraft(draft);
                        setScreen("nova-aula");
                      }}
                    >
                      Continuar
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm("Excluir este rascunho local?")) return;
                        const result = await window.gearContentStudio.deleteDraft(
                          draft.id,
                        );
                        if (!result.ok) {
                          setError(`${result.error.title}: ${result.error.message}`);
                          return;
                        }
                        setDrafts((current) =>
                          current.filter((candidate) => candidate.id !== draft.id),
                        );
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
              {!drafts.length && <div className="empty">Nenhum rascunho salvo.</div>}
            </div>
          </section>
        )}
        {screen === "configuracao" && (
          <section className="narrow">
            <span className="eyebrow">Onboarding</span>
            <h1>Configurar repositório</h1>
            <p>
              O app criará um clone exclusivo em LocalAppData e usará a autenticação já
              configurada no Git Credential Manager.
            </p>
            <label>
              Remoto HTTPS do Portal
              <input
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={async () => {
                setBusy(true);
                const result = await window.gearContentStudio.configure({ remoteUrl });
                setBusy(false);
                if (!result.ok) return setError(result.error.message);
                await refresh();
                setScreen("inicio");
              }}
            >
              {busy ? "Salvando…" : "Salvar configuração"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
