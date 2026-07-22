import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AreaCollectionEntry,
  CatalogEntry,
  CategoryCollectionEntry,
  ContentBlock,
  EnvironmentStatus,
  LessonDraft,
  PublishBundle,
  ReviewBundle,
  SidebarItemId,
  TagCollectionEntry,
  TechnologyCollectionEntry,
} from "../shared/types";
import { DEFAULT_SIDEBAR_ORDER } from "../shared/types";
import { toSlug } from "../shared/slug";
import { EXPECTED_REMOTE_URL } from "../shared/schema";
import { DEFAULT_COVER_PATH } from "../shared/content-defaults";
import { GEAR_LOGO_COMPACT_DATA_URL } from "../shared/brand-assets";
import { normalizeTag } from "../shared/tag-collection";

const randomUUID = () => crypto.randomUUID();

type Screen = SidebarItemId;

type ConfirmOptions = {
  eyebrow?: string;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
};

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

function useConfirm() {
  return useContext(ConfirmContext);
}

function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<
    (ConfirmOptions & { resolve: (confirmed: boolean) => void }) | undefined
  >();

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(undefined);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={() => close(false)}
        >
          <section
            aria-describedby="confirm-message"
            aria-labelledby="confirm-title"
            aria-modal="true"
            className={`confirm-dialog ${pending.tone === "danger" ? "danger" : ""}`}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <span className="eyebrow">{pending.eyebrow ?? "Confirmação"}</span>
            <h2 id="confirm-title">{pending.title}</h2>
            <p id="confirm-message">{pending.message}</p>
            <div className="confirm-actions">
              <button autoFocus type="button" onClick={() => close(false)}>
                Cancelar
              </button>
              <button
                className={pending.tone === "danger" ? "danger" : "primary"}
                type="button"
                onClick={() => close(true)}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

const sidebarLabels: Record<SidebarItemId, string> = {
  inicio: "Início",
  catalogo: "Catálogo",
  "nova-aula": "Novo conteúdo",
  rascunhos: "Rascunhos",
  tags: "Coleção • Tags",
  categorias: "Coleção • Categorias",
  areas: "Coleção • Áreas",
  tecnologias: "Coleção • Tecnologias",
  configuracao: "Configurações",
};

const today = () => new Date().toISOString().slice(0, 10);

const statusesFor = (entries: readonly CatalogEntry[], type = ""): string[] =>
  [
    ...new Set(
      entries
        .filter((entry) => !type || entry.type === type)
        .map((entry) => entry.status),
    ),
  ].sort((first, second) =>
    first.localeCompare(second, "pt-BR", { sensitivity: "base" }),
  );

const typesFor = (
  entries: readonly CatalogEntry[],
  status = "",
): CatalogEntry["type"][] =>
  [
    ...new Set(
      entries
        .filter((entry) => !status || entry.status === status)
        .map((entry) => entry.type),
    ),
  ].sort();

const contentTypeLabel: Record<CatalogEntry["type"], string> = {
  aula: "Aulas",
  curso: "Cursos",
  trilha: "Trilhas",
  projeto: "Projetos",
  noticia: "Notícias",
};

const suggestionStopWords = new Set([
  "a",
  "ao",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "uma",
  "um",
]);

const suggestionTokens = (value: string) =>
  new Set(
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3 && !suggestionStopWords.has(token)),
  );

type MetadataSuggestion = Readonly<{
  value: string;
  score: number;
  usages: number;
  types: CatalogEntry["type"][];
}>;

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
  if (type === "aula") {
    return {
      ...current,
      titulo: "Criando classes em Python do zero",
      slug: "criando-classes-em-python",
      resumo:
        "Aprenda a modelar objetos em Python usando classes, atributos, métodos, construtores, herança e composição.",
      tags: ["python", "programação", "orientação a objetos", "fundamentos"],
      categoria: "Programação",
      dificuldade: "iniciante",
      autores: ["Equipe GEAR"],
      preRequisitos: [],
      videos: [],
      linksExternos: [
        {
          titulo: "Documentação oficial de classes em Python",
          url: "https://docs.python.org/3/tutorial/classes.html",
        },
        {
          titulo: "PEP 8 — guia de estilo",
          url: "https://peps.python.org/pep-0008/",
        },
      ],
      repositorioGithub: "https://github.com/python/cpython",
      status: "rascunho",
      permiteComentarios: true,
      body: [
        {
          id: randomUUID(),
          kind: "heading",
          level: 2,
          text: "O que você vai aprender",
        },
        {
          id: randomUUID(),
          kind: "paragraph",
          markdown:
            "Uma classe é um molde; um objeto é uma instância criada a partir desse molde. Nesta aula vamos construir uma classe **Robo** passo a passo.",
        },
        {
          id: randomUUID(),
          kind: "video",
          titulo: "Vídeo introdutório sobre orientação a objetos",
          url: "https://www.youtube.com/watch?v=apACNr7DC_s",
        },
        {
          id: randomUUID(),
          kind: "paragraph",
          markdown:
            "Assista ao [vídeo introdutório sobre orientação a objetos](https://www.youtube.com/watch?v=apACNr7DC_s) antes de começar.",
        },
        {
          id: randomUUID(),
          kind: "heading",
          level: 2,
          text: "Criando a primeira classe",
        },
        {
          id: randomUUID(),
          kind: "code",
          language: "python",
          code: "class Robo:\n    pass\n\nwall_e = Robo()\nprint(type(wall_e))",
        },
        {
          id: randomUUID(),
          kind: "heading",
          level: 2,
          text: "Atributos, métodos e self",
        },
        {
          id: randomUUID(),
          kind: "paragraph",
          markdown:
            "O método `__init__` prepara o estado inicial. `self` representa o próprio objeto, enquanto os métodos definem seus comportamentos.",
        },
        {
          id: randomUUID(),
          kind: "code",
          language: "python",
          code: 'class Robo:\n    def __init__(self, nome, bateria=100):\n        self.nome = nome\n        self.bateria = bateria\n\n    def mover(self, distancia):\n        consumo = distancia * 2\n        if consumo > self.bateria:\n            return "Bateria insuficiente."\n        self.bateria -= consumo\n        return f"{self.nome} moveu {distancia} metros."\n\nrobo = Robo("Luna", 80)\nprint(robo.mover(10))',
        },
        {
          id: randomUUID(),
          kind: "heading",
          level: 2,
          text: "Herança e composição",
        },
        {
          id: randomUUID(),
          kind: "video",
          titulo: "Vídeo complementar da aula",
          url: "https://www.youtube.com/watch?v=JeznW_7DlB0",
        },
        {
          id: randomUUID(),
          kind: "paragraph",
          markdown:
            "Use herança quando um objeto **é um** tipo especializado de outro. Use composição quando ele **tem um** componente, como um robô que possui um sensor.",
        },
        {
          id: randomUUID(),
          kind: "quote",
          markdown:
            "Desafio: crie uma classe ContaBancaria com titular, saldo, depositar e sacar.",
        },
        {
          id: randomUUID(),
          kind: "paragraph",
          markdown:
            "Para aprofundar, consulte a [documentação oficial de classes](https://docs.python.org/3/tutorial/classes.html) e o [guia PEP 8](https://peps.python.org/pep-0008/).",
        },
      ],
    };
  }
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
    preRequisitos: [],
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
    videos: type === "projeto" ? ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"] : [],
    linksExternos: [],
    repositorioGithub:
      type === "projeto" ? "https://github.com/Tiago1a2a3a/Site_Gear" : undefined,
    tecnologias: type === "projeto" ? ["TypeScript", "MDX", "Git"] : undefined,
    documentacao:
      type === "projeto" ? "https://github.com/Tiago1a2a3a/Site_Gear" : undefined,
    destaque: type === "curso" || type === "projeto" ? true : undefined,
    ordem: type === "trilha" ? number : undefined,
    status: "publicado",
    permiteComentarios: false,
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
  onCreate,
}: {
  environment?: EnvironmentStatus;
  catalog: CatalogEntry[];
  onCreate(): void;
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
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("title-asc");
  const [selected, setSelected] = useState<CatalogEntry>();
  const [deleting, setDeleting] = useState(false);
  const types = useMemo(() => typesFor(entries, status), [entries, status]);
  const statuses = useMemo(() => statusesFor(entries, type), [entries, type]);
  useEffect(() => {
    if (
      selected &&
      !entries.some((entry) => entry.sourcePath === selected.sourcePath)
    ) {
      setSelected(undefined);
    }
  }, [entries, selected]);
  useEffect(() => {
    if (status && !statuses.includes(status)) setStatus("");
  }, [status, statuses]);
  useEffect(() => {
    if (type && !types.includes(type as CatalogEntry["type"])) setType("");
  }, [type, types]);
  const visible = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    const filtered = entries.filter(
      (entry) =>
        (!type || entry.type === type) &&
        (!status || entry.status === status) &&
        (!normalized ||
          [entry.titulo, entry.slug, entry.summary, ...entry.tags]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(normalized)),
    );
    const byTitle = (first: CatalogEntry, second: CatalogEntry) =>
      first.titulo.localeCompare(second.titulo, "pt-BR", { sensitivity: "base" });
    return filtered.sort((first, second) => {
      if (sort === "title-desc") return -byTitle(first, second);
      if (sort === "date-desc" || sort === "date-asc") {
        if (!first.publicationDate && !second.publicationDate) {
          return byTitle(first, second);
        }
        if (!first.publicationDate) return 1;
        if (!second.publicationDate) return -1;
        const comparison = first.publicationDate.localeCompare(second.publicationDate);
        return comparison === 0
          ? byTitle(first, second)
          : sort === "date-desc"
            ? -comparison
            : comparison;
      }
      return byTitle(first, second);
    });
  }, [entries, query, sort, status, type]);
  const formatDate = (value?: string) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
          new Date(`${value}T00:00:00Z`),
        )
      : "Data não informada";
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
          <div className="catalog-panel-heading">
            <div>
              <span className="eyebrow">Refinar lista</span>
              <h2>Filtros</h2>
            </div>
            <span>{visible.length}</span>
          </div>
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
              {types.map((value) => (
                <option value={value} key={value}>
                  {contentTypeLabel[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {statuses.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ordenar por
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="title-asc">Título: A–Z</option>
              <option value="title-desc">Título: Z–A</option>
              <option value="date-desc">Publicação: mais recente</option>
              <option value="date-asc">Publicação: mais antiga</option>
            </select>
          </label>
          <button
            className="filter-reset"
            type="button"
            disabled={!query && !type && !status && sort === "title-asc"}
            onClick={() => {
              setQuery("");
              setType("");
              setStatus("");
              setSort("title-asc");
            }}
          >
            Limpar filtros
          </button>
        </aside>
        <div className="catalog-list">
          {visible.map((entry) => (
            <button
              className={`catalog-item${selected?.sourcePath === entry.sourcePath ? " selected" : ""}`}
              key={entry.sourcePath}
              onClick={() => setSelected(entry)}
              aria-pressed={selected?.sourcePath === entry.sourcePath}
            >
              <span className={`badge ${entry.type}`}>{entry.type}</span>
              <strong>{entry.titulo}</strong>
              <span className={`catalog-status ${entry.status}`}>{entry.status}</span>
              <p>{entry.summary}</p>
              <small className="catalog-date">
                Publicação: {formatDate(entry.publicationDate)}
                {entry.difficulty ? ` • ${entry.difficulty}` : ""}
              </small>
            </button>
          ))}
          {!visible.length && <div className="empty">Nenhum conteúdo encontrado.</div>}
        </div>
        <aside className="detail">
          {selected ? (
            <>
              <div className="detail-body">
                <div className="catalog-panel-heading">
                  <div>
                    <span className="eyebrow">Item selecionado</span>
                    <span className={`badge ${selected.type}`}>{selected.type}</span>
                  </div>
                </div>
                <h2>{selected.titulo}</h2>
                <code>{selected.slug}</code>
                <p>{selected.summary}</p>
                <dl>
                  <dt>Status</dt>
                  <dd>{selected.status}</dd>
                  <dt>Data de publicação</dt>
                  <dd>{formatDate(selected.publicationDate)}</dd>
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
              </div>
              <div className="detail-actions">
                <button
                  className="danger detail-action"
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
                <button
                  className="detail-action"
                  disabled={deleting}
                  onClick={() => void onEdit(selected)}
                >
                  Editar conteúdo
                </button>
              </div>
            </>
          ) : (
            <div className="empty">Selecione um conteúdo para ver detalhes.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

function TagCollection({
  tags,
  catalog,
  onUpdate,
}: {
  tags: TagCollectionEntry[];
  catalog: CatalogEntry[];
  onUpdate(
    input: Readonly<{
      tag: string;
      replacement?: string;
      sourcePath?: string;
      enabled?: boolean;
    }>,
  ): Promise<boolean>;
}) {
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("title-asc");
  const [selected, setSelected] = useState<TagCollectionEntry>();
  const [replacement, setReplacement] = useState("");
  const [saving, setSaving] = useState(false);
  const [membershipType, setMembershipType] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("");
  const [membershipSort, setMembershipSort] = useState("title-asc");
  const [savingPath, setSavingPath] = useState("");
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = tags.filter(
      (tag) => !normalized || tag.tag.toLocaleLowerCase("pt-BR").includes(normalized),
    );
    return filtered.sort((first, second) => {
      const byTitle = first.tag.localeCompare(second.tag, "pt-BR", {
        sensitivity: "base",
      });
      if (sort === "title-desc") return -byTitle;
      if (sort === "usages-desc") return second.usages - first.usages || byTitle;
      if (sort === "usages-asc") return first.usages - second.usages || byTitle;
      return byTitle;
    });
  }, [query, sort, tags]);

  useEffect(() => {
    if (selected && tags.some((tag) => tag.tag === selected.tag)) return;
    setSelected(tags[0]);
  }, [selected, tags]);

  useEffect(() => {
    setReplacement(selected?.tag ?? "");
  }, [selected]);

  const taggableEntries = useMemo(
    () => catalog.filter((entry) => entry.type !== "trilha"),
    [catalog],
  );
  const membershipStatuses = useMemo(
    () => statusesFor(taggableEntries, membershipType),
    [membershipType, taggableEntries],
  );
  const membershipTypes = useMemo(
    () => typesFor(taggableEntries, membershipStatus),
    [membershipStatus, taggableEntries],
  );
  useEffect(() => {
    if (membershipStatus && !membershipStatuses.includes(membershipStatus)) {
      setMembershipStatus("");
    }
  }, [membershipStatus, membershipStatuses]);
  useEffect(() => {
    if (
      membershipType &&
      !membershipTypes.includes(membershipType as CatalogEntry["type"])
    ) {
      setMembershipType("");
    }
  }, [membershipType, membershipTypes]);
  const membershipEntries = useMemo(() => {
    if (!selected) return [];
    const isRelated = (entry: CatalogEntry) =>
      entry.tags.some((tag) => normalizeTag(tag) === normalizeTag(selected.tag));
    const filtered = taggableEntries.filter(
      (entry) =>
        (!membershipType || entry.type === membershipType) &&
        (!membershipStatus || entry.status === membershipStatus) &&
        isRelated(entry),
    );
    return filtered.sort((first, second) => {
      const byTitle = first.titulo.localeCompare(second.titulo, "pt-BR", {
        sensitivity: "base",
      });
      if (membershipSort === "title-desc") return -byTitle;
      if (membershipSort === "type")
        return first.type.localeCompare(second.type) || byTitle;
      if (membershipSort === "status")
        return first.status.localeCompare(second.status) || byTitle;
      if (membershipSort === "related") {
        return Number(isRelated(second)) - Number(isRelated(first)) || byTitle;
      }
      return byTitle;
    });
  }, [membershipSort, membershipStatus, membershipType, selected, taggableEntries]);

  const submit = async (input: Readonly<{ tag: string; replacement?: string }>) => {
    setSaving(true);
    try {
      return await onUpdate(input);
    } finally {
      setSaving(false);
    }
  };

  const updateMembership = async (
    input: Readonly<{ sourcePath: string; enabled: boolean }>,
  ) => {
    if (!selected) return false;
    setSavingPath(input.sourcePath);
    try {
      return await onUpdate({ tag: selected.tag, ...input });
    } finally {
      setSavingPath("");
    }
  };

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Coleção</span>
          <h1>Tags</h1>
        </div>
        <span>{tags.length} tags</span>
      </div>
      <div className="tag-collection-layout">
        <div className="tag-collection-list panel">
          <div className="tag-collection-controls">
            <label>
              Buscar tag
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome da tag"
              />
            </label>
            <label>
              Organizar por
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="title-asc">Nome: A–Z</option>
                <option value="title-desc">Nome: Z–A</option>
                <option value="usages-desc">Mais usadas</option>
                <option value="usages-asc">Menos usadas</option>
              </select>
            </label>
          </div>
          <p className="tag-collection-summary">{visible.length} resultado(s)</p>
          <div className="tag-collection-items">
            {visible.map((tag) => (
              <button
                className={selected?.tag === tag.tag ? "active" : ""}
                type="button"
                key={tag.tag}
                onClick={() => setSelected(tag)}
              >
                <strong>{tag.tag}</strong>
                <small>{tag.usages} MDX relacionado(s)</small>
              </button>
            ))}
            {!visible.length && <div className="empty">Nenhuma tag encontrada.</div>}
          </div>
        </div>
        <aside className="tag-collection-detail panel">
          {selected ? (
            <>
              <span className="eyebrow">Tag selecionada</span>
              <h2>{selected.tag}</h2>
              <p>
                Esta tag aparece em <strong>{selected.usages}</strong> arquivo(s) MDX.
              </p>
              <div className="tag-type-list">
                {selected.types.map((type) => (
                  <span className={`badge ${type}`} key={type}>
                    {type}
                  </span>
                ))}
              </div>
              <label>
                Renomear para
                <input
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  maxLength={200}
                />
              </label>
              <button
                className="detail-action"
                type="button"
                disabled={
                  saving || !replacement.trim() || replacement.trim() === selected.tag
                }
                onClick={async () => {
                  const next = replacement.trim();
                  if (
                    !(await confirm({
                      eyebrow: "Alteração global",
                      title: "Renomear tag em todos os conteúdos?",
                      message: `A tag “${selected.tag}” será renomeada para “${next}” em ${selected.usages} arquivo(s) MDX e enviada para origin/main.`,
                      confirmLabel: "Renomear tag",
                    }))
                  )
                    return;
                  if (await submit({ tag: selected.tag, replacement: next })) {
                    setSelected(undefined);
                  }
                }}
              >
                {saving ? "Salvando…" : "Salvar novo nome"}
              </button>
              <button
                className="danger detail-action"
                type="button"
                disabled={saving}
                onClick={async () => {
                  if (
                    !(await confirm({
                      eyebrow: "Ação irreversível",
                      title: "Excluir tag de todos os conteúdos?",
                      message: `A tag “${selected.tag}” será removida de ${selected.usages} arquivo(s) MDX e a alteração será enviada para origin/main.`,
                      confirmLabel: "Excluir tag",
                      tone: "danger",
                    }))
                  )
                    return;
                  if (await submit({ tag: selected.tag })) setSelected(undefined);
                }}
              >
                Excluir tag de todos os conteúdos
              </button>
              <div className="tag-membership-heading">
                <div>
                  <span className="eyebrow">Conteúdos</span>
                  <h3>Conteúdos com a tag</h3>
                </div>
                <span>{membershipEntries.length}</span>
              </div>
              <div className="tag-membership-controls">
                <label>
                  Coleção
                  <select
                    value={membershipType}
                    onChange={(event) => setMembershipType(event.target.value)}
                  >
                    <option value="">Todas</option>
                    {membershipTypes.map((type) => (
                      <option value={type} key={type}>
                        {contentTypeLabel[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    value={membershipStatus}
                    onChange={(event) => setMembershipStatus(event.target.value)}
                  >
                    <option value="">Todos</option>
                    {membershipStatuses.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ordenar
                  <select
                    value={membershipSort}
                    onChange={(event) => setMembershipSort(event.target.value)}
                  >
                    <option value="title-asc">Título: A–Z</option>
                    <option value="title-desc">Título: Z–A</option>
                    <option value="related">Com tag primeiro</option>
                    <option value="type">Coleção</option>
                    <option value="status">Estado</option>
                  </select>
                </label>
              </div>
              <div className="tag-membership-list">
                {membershipEntries.map((entry) => {
                  const related = entry.tags.some(
                    (tag) => normalizeTag(tag) === normalizeTag(selected.tag),
                  );
                  return (
                    <label
                      className={`tag-membership-card${related ? " related" : ""}`}
                      key={entry.sourcePath}
                    >
                      <input
                        type="checkbox"
                        checked={related}
                        disabled={saving || savingPath === entry.sourcePath}
                        onChange={async (event) => {
                          const enabled = event.target.checked;
                          if (
                            !(await confirm({
                              eyebrow: "Coleção de tags",
                              title: `${enabled ? "Adicionar" : "Remover"} tag deste conteúdo?`,
                              message: `A tag “${selected.tag}” será ${enabled ? "adicionada ao" : "removida do"} conteúdo “${entry.titulo}” e enviada para origin/main.`,
                              confirmLabel: enabled ? "Adicionar tag" : "Remover tag",
                              tone: enabled ? "default" : "danger",
                            }))
                          )
                            return;
                          await updateMembership({
                            sourcePath: entry.sourcePath,
                            enabled,
                          });
                        }}
                      />
                      <span className="tag-membership-copy">
                        <strong>{entry.titulo}</strong>
                        <small>{entry.sourcePath}</small>
                      </span>
                      <span className="tag-membership-meta">
                        <span className={`badge ${entry.type}`}>{entry.type}</span>
                        <span className={`catalog-status ${entry.status}`}>
                          {entry.status}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty">Selecione uma tag para editar ou excluir.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

function CategoryCollection({
  categories,
  catalog,
  onUpdate,
  collectionLabel = "Categorias",
  itemLabel = "categoria",
  itemPlural = "categorias",
  onRemoveMembership,
}: {
  categories: Array<CategoryCollectionEntry | AreaCollectionEntry>;
  catalog: CatalogEntry[];
  onUpdate(
    input: Readonly<{ category: string; replacement?: string }>,
  ): Promise<boolean>;
  collectionLabel?: string;
  itemLabel?: string;
  itemPlural?: string;
  onRemoveMembership?(sourcePath: string, category: string): Promise<boolean>;
}) {
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("title-asc");
  const [selected, setSelected] = useState<CategoryCollectionEntry>();
  const [replacement, setReplacement] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPath, setSavingPath] = useState("");
  const visible = useMemo(() => {
    const normalized = normalizeTag(query);
    return categories
      .filter(
        (category) =>
          !normalized || normalizeTag(category.category).includes(normalized),
      )
      .sort((first, second) => {
        if (sort === "usages-desc")
          return (
            second.usages - first.usages ||
            first.category.localeCompare(second.category, "pt-BR")
          );
        if (sort === "usages-asc")
          return (
            first.usages - second.usages ||
            first.category.localeCompare(second.category, "pt-BR")
          );
        const byName = first.category.localeCompare(second.category, "pt-BR", {
          sensitivity: "base",
        });
        return sort === "title-desc" ? -byName : byName;
      });
  }, [categories, query, sort]);
  const related = useMemo(
    () =>
      selected
        ? catalog.filter((entry) => selected.contentPaths.includes(entry.sourcePath))
        : [],
    [catalog, selected],
  );

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Coleção</span>
          <h1>{collectionLabel}</h1>
        </div>
        <span>
          {categories.length} {itemPlural}
        </span>
      </div>
      <div className="tag-collection-layout">
        <div className="tag-collection-list panel">
          <div className="tag-collection-controls">
            <label>
              Buscar {itemLabel}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Nome da ${itemLabel}`}
              />
            </label>
            <label>
              Ordenar
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="title-asc">Nome: A–Z</option>
                <option value="title-desc">Nome: Z–A</option>
                <option value="usages-desc">Mais usadas</option>
                <option value="usages-asc">Menos usadas</option>
              </select>
            </label>
          </div>
          <p className="tag-collection-summary">{visible.length} resultado(s)</p>
          <div className="tag-collection-items">
            {visible.map((category) => (
              <button
                className={selected?.category === category.category ? "active" : ""}
                type="button"
                key={category.category}
                onClick={() => {
                  setSelected(category);
                  setReplacement(category.category);
                }}
              >
                <strong>{category.category}</strong>
                <small>{category.usages} MDX relacionado(s)</small>
              </button>
            ))}
            {!visible.length && (
              <div className="empty">Nenhuma categoria encontrada.</div>
            )}
          </div>
        </div>
        <aside className="tag-collection-detail panel">
          {selected ? (
            <>
              <span className="eyebrow">
                {itemLabel[0]!.toUpperCase() + itemLabel.slice(1)} selecionada
              </span>
              <h2>{selected.category}</h2>
              <p>
                Esta {itemLabel} aparece em <strong>{selected.usages}</strong>{" "}
                arquivo(s) MDX.
              </p>
              <div className="tag-type-list">
                {selected.types.map((type) => (
                  <span className={`badge ${type}`} key={type}>
                    {type}
                  </span>
                ))}
              </div>
              <label>
                Renomear para
                <input
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  maxLength={200}
                />
              </label>
              <button
                className="detail-action"
                type="button"
                disabled={
                  saving ||
                  !replacement.trim() ||
                  replacement.trim() === selected.category
                }
                onClick={async () => {
                  const next = replacement.trim();
                  if (
                    !(await confirm({
                      eyebrow: "Alteração global",
                      title: `Renomear ${itemLabel} em todos os conteúdos?`,
                      message: `A ${itemLabel} “${selected.category}” será renomeada para “${next}” em ${selected.usages} arquivo(s) MDX e enviada para origin/main.`,
                      confirmLabel: `Renomear ${itemLabel}`,
                    }))
                  )
                    return;
                  setSaving(true);
                  if (
                    await onUpdate({ category: selected.category, replacement: next })
                  )
                    setSelected(undefined);
                  setSaving(false);
                }}
              >
                {saving ? "Salvando…" : "Salvar novo nome"}
              </button>
              <button
                className="danger detail-action"
                type="button"
                disabled={saving}
                onClick={async () => {
                  if (
                    !(await confirm({
                      eyebrow: "Ação irreversível",
                      title: `Remover ${itemLabel} de todos os conteúdos?`,
                      message: `A ${itemLabel} “${selected.category}” será removida de ${selected.usages} arquivo(s) MDX e a alteração será enviada para origin/main.`,
                      confirmLabel: `Remover ${itemLabel}`,
                      tone: "danger",
                    }))
                  )
                    return;
                  setSaving(true);
                  if (await onUpdate({ category: selected.category }))
                    setSelected(undefined);
                  setSaving(false);
                }}
              >
                Remover {itemLabel} de todos os conteúdos
              </button>
              <div className="tag-membership-heading">
                <div>
                  <span className="eyebrow">Conteúdos</span>
                  <h3>Conteúdos com a {itemLabel}</h3>
                </div>
                <span>{related.length}</span>
              </div>
              <div className="category-membership-list">
                {related.map((entry) => (
                  <label className="category-membership-card" key={entry.sourcePath}>
                    <input
                      type="checkbox"
                      checked
                      disabled={saving || savingPath === entry.sourcePath}
                      onChange={async (event) => {
                        if (event.target.checked || !onRemoveMembership) return;
                        if (
                          !(await confirm({
                            eyebrow: `Coleção de ${itemPlural}`,
                            title: `Remover ${itemLabel} deste conteúdo?`,
                            message: `A ${itemLabel} “${selected.category}” será removida somente de “${entry.titulo}” e enviada para origin/main.`,
                            confirmLabel: `Remover ${itemLabel}`,
                            tone: "danger",
                          }))
                        )
                          return;
                        setSavingPath(entry.sourcePath);
                        try {
                          await onRemoveMembership(entry.sourcePath, selected.category);
                        } finally {
                          setSavingPath("");
                        }
                      }}
                    />
                    <span className="category-membership-copy">
                      <strong>{entry.titulo}</strong>
                      <small>{entry.sourcePath}</small>
                    </span>
                    <span className="tag-membership-meta">
                      <span className={`badge ${entry.type}`}>{entry.type}</span>
                      <span className={`catalog-status ${entry.status}`}>
                        {entry.status}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              Selecione uma {itemLabel} para editar ou remover.
            </div>
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
  const confirm = useConfirm();
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
              : kind === "video"
                ? {
                    id,
                    kind,
                    titulo: "Vídeo da aula",
                    url: "https://www.youtube.com/watch?v=",
                  }
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
            "video",
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
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Remover este bloco?",
                        message:
                          "O conteúdo deste bloco será removido do rascunho atual.",
                        confirmLabel: "Remover bloco",
                        tone: "danger",
                      })
                    ) {
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
            ) : block.kind === "video" ? (
              <div className="inline">
                <input
                  value={block.titulo}
                  onChange={(event) =>
                    update(index, { ...block, titulo: event.target.value })
                  }
                  placeholder="Título do vídeo"
                />
                <input
                  value={block.url}
                  onChange={(event) =>
                    update(index, { ...block, url: event.target.value })
                  }
                  placeholder="URL HTTPS do YouTube"
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

function ContentPicker({
  title,
  candidates,
  selectedCount,
  embedded = false,
  className = "",
  isSelected,
  isUnavailable = () => false,
  onSelectionChange,
}: {
  title: string;
  candidates: CatalogEntry[];
  selectedCount: number;
  embedded?: boolean;
  className?: string;
  isSelected(entry: CatalogEntry): boolean;
  isUnavailable?(entry: CatalogEntry): boolean;
  onSelectionChange(entry: CatalogEntry, selected: boolean): void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("title-asc");
  const [page, setPage] = useState(1);
  const statuses = useMemo(() => statusesFor(candidates, type), [candidates, type]);
  const types = useMemo(() => typesFor(candidates, status), [candidates, status]);

  useEffect(() => {
    if (status && !statuses.includes(status)) setStatus("");
  }, [status, statuses]);
  useEffect(() => {
    if (type && !types.includes(type as CatalogEntry["type"])) setType("");
  }, [type, types]);
  useEffect(() => setPage(1), [query, sort, status, type]);

  const options = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase("pt-BR");
    const normalizedQuery = normalize(query.trim());
    return candidates
      .filter(
        (entry) =>
          isSelected(entry) ||
          ((!normalizedQuery ||
            normalize([entry.titulo, entry.slug, ...entry.tags].join(" ")).includes(
              normalizedQuery,
            )) &&
            (!type || entry.type === type) &&
            (!status || entry.status === status)),
      )
      .sort((first, second) => {
        const byTitle = first.titulo.localeCompare(second.titulo, "pt-BR", {
          sensitivity: "base",
        });
        if (sort === "title-desc") return -byTitle;
        if (sort === "selected")
          return Number(isSelected(second)) - Number(isSelected(first)) || byTitle;
        if (sort === "date-desc" || sort === "date-asc") {
          if (!first.publicationDate && !second.publicationDate) return byTitle;
          if (!first.publicationDate) return 1;
          if (!second.publicationDate) return -1;
          const byDate = first.publicationDate.localeCompare(second.publicationDate);
          return byDate === 0 ? byTitle : sort === "date-desc" ? -byDate : byDate;
        }
        return byTitle;
      });
  }, [candidates, isSelected, query, sort, status, type]);

  const activeFilters =
    Number(Boolean(type)) + Number(Boolean(status)) + Number(sort !== "title-asc");
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(options.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = options.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const content = (
    <>
      <div className="dependency-search">
        <label className="dependency-search-field">
          <span>Buscar conteúdo</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite o título ou slug"
          />
        </label>
        <details className="dependency-filter-menu">
          <summary>
            Filtros
            {activeFilters > 0 && <span>{activeFilters}</span>}
          </summary>
          <div className="dependency-filter-popover">
            <label>
              Tipo
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">Todos</option>
                {types.map((entryType) => (
                  <option value={entryType} key={entryType}>
                    {contentTypeLabel[entryType]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                {statuses.map((entryStatus) => (
                  <option value={entryStatus} key={entryStatus}>
                    {entryStatus}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="title-asc">Título: A–Z</option>
                <option value="title-desc">Título: Z–A</option>
                <option value="date-desc">Mais recentes</option>
                <option value="date-asc">Mais antigos</option>
                <option value="selected">Selecionados primeiro</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!activeFilters}
              onClick={() => {
                setType("");
                setStatus("");
                setSort("title-asc");
              }}
            >
              Limpar filtros
            </button>
          </div>
        </details>
      </div>
      <p className="dependency-summary">
        {options.length
          ? `Mostrando ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, options.length)} de ${options.length}`
          : "0 resultados"}{" "}
        • {selectedCount} selecionado(s)
        {query && (
          <button type="button" onClick={() => setQuery("")}>
            Limpar busca
          </button>
        )}
      </p>
      <div className="dependency-grid">
        {visible.map((entry) => {
          const checked = isSelected(entry);
          const unavailable = isUnavailable(entry);
          return (
            <label
              className={`dependency-card${checked ? " selected" : ""}${unavailable ? " unavailable" : ""}`}
              key={`${entry.type}:${entry.slug}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={unavailable}
                onChange={(event) => onSelectionChange(entry, event.target.checked)}
              />
              <span className="dependency-card-copy">
                <strong>{entry.titulo}</strong>
                <small>
                  {entry.slug}
                  {entry.publicationDate
                    ? ` • ${entry.publicationDate}`
                    : " • sem data"}
                </small>
              </span>
              <span className="dependency-card-meta">
                <span className={`badge ${entry.type}`}>{entry.type}</span>
                <span className={`catalog-status ${entry.status}`}>{entry.status}</span>
              </span>
            </label>
          );
        })}
        {!options.length && (
          <div className="dependency-empty">
            Nenhum conteúdo encontrado para essa busca.
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <nav className="dependency-pagination" aria-label={`Páginas de ${title}`}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </button>
          <div>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  className={pageNumber === currentPage ? "active" : ""}
                  type="button"
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  );

  return embedded ? (
    <div className="content-picker">{content}</div>
  ) : (
    <fieldset className={`wide content-picker ${className}`.trim()}>
      <legend>{title}</legend>
      {content}
    </fieldset>
  );
}

function MetadataSuggestionPanel({
  label,
  suggestions,
  allCandidates,
  defaultOpen = false,
  onApply,
  onCreate,
}: {
  label: string;
  suggestions: MetadataSuggestion[];
  allCandidates: MetadataSuggestion[];
  defaultOpen?: boolean;
  onApply(value: string): void;
  onCreate?(value: string): void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("relevance");
  const types = useMemo(
    () => [...new Set(allCandidates.flatMap((suggestion) => suggestion.types))].sort(),
    [allCandidates],
  );
  const visible = useMemo(() => {
    const normalized = normalizeTag(query);
    return allCandidates
      .filter(
        (suggestion) =>
          (!normalized || normalizeTag(suggestion.value).includes(normalized)) &&
          (!type || suggestion.types.includes(type as CatalogEntry["type"])),
      )
      .sort((first, second) => {
        if (sort === "title-asc")
          return first.value.localeCompare(second.value, "pt-BR");
        if (sort === "usages")
          return second.usages - first.usages || second.score - first.score;
        return (
          second.score - first.score ||
          second.usages - first.usages ||
          first.value.localeCompare(second.value, "pt-BR")
        );
      });
  }, [allCandidates, query, sort, type]);
  const valueToCreate = query.trim();
  const alreadyExists = allCandidates.some(
    (suggestion) => normalizeTag(suggestion.value) === normalizeTag(valueToCreate),
  );
  const itemLabel =
    label === "categorias"
      ? "categoria"
      : label === "áreas"
        ? "área"
        : label === "tecnologias"
          ? "tecnologia"
          : "tag";

  if (!suggestions.length && !allCandidates.length && !onCreate) return null;
  return (
    <div className="metadata-suggestions">
      {suggestions.length ? (
        <div className="metadata-recommendations">
          <div className="metadata-suggestions-heading">
            <strong>Sugestões de {label}</strong>
            <span>{suggestions.length}</span>
          </div>
          <div className="metadata-suggestion-list metadata-recommendation-list">
            {suggestions.slice(0, 8).map((suggestion) => (
              <button
                type="button"
                key={suggestion.value}
                onClick={() => onApply(suggestion.value)}
              >
                <span>{suggestion.value}</span>
                <small>{suggestion.usages} uso(s)</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <details className="metadata-explorer" open={defaultOpen}>
        <summary>Buscar e filtrar {label} existentes</summary>
        <div className="metadata-suggestions-controls">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar sugestão de ${label}`}
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label={`Filtrar sugestões de ${label} por tipo`}
          >
            <option value="">Todos os tipos</option>
            {types.map((entryType) => (
              <option value={entryType} key={entryType}>
                {contentTypeLabel[entryType]}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label={`Ordenar sugestões de ${label}`}
          >
            <option value="relevance">Mais relacionadas</option>
            <option value="usages">Mais usadas</option>
            <option value="title-asc">Nome: A–Z</option>
          </select>
        </div>
        {onCreate && valueToCreate && !alreadyExists ? (
          <button
            className="metadata-create-option"
            type="button"
            onClick={() => {
              onCreate(valueToCreate);
              setQuery("");
            }}
          >
            Criar {itemLabel} “{valueToCreate}”
          </button>
        ) : null}
        <div className="metadata-suggestion-list">
          {visible.map((suggestion) => (
            <button
              type="button"
              key={suggestion.value}
              onClick={() => onApply(suggestion.value)}
            >
              <span>{suggestion.value}</span>
              <small>{suggestion.usages} uso(s)</small>
            </button>
          ))}
          {!visible.length && (
            <small className="metadata-suggestion-empty">
              Nenhuma sugestão corresponde aos filtros.
            </small>
          )}
        </div>
      </details>
    </div>
  );
}

function LessonEditor({
  initialDraft,
  catalog,
  onSaved,
  onDraftChange,
  advancedMode,
}: {
  initialDraft: LessonDraft;
  catalog: CatalogEntry[];
  onSaved(draftId: string, commit: string): void;
  onDraftChange(draft: LessonDraft): void;
  advancedMode: boolean;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewBundle>();
  const [publish, setPublish] = useState<PublishBundle>();
  const [publishedCommit, setPublishedCommit] = useState("");
  const [prerequisiteQuery, setPrerequisiteQuery] = useState("");
  const [prerequisiteType, setPrerequisiteType] = useState("");
  const [prerequisiteStatus, setPrerequisiteStatus] = useState("");
  const [prerequisiteSort, setPrerequisiteSort] = useState("title-asc");
  const [prerequisitePage, setPrerequisitePage] = useState(1);
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
  const metadataSuggestions = useMemo(() => {
    const selectedEntries =
      draft.contentType === "curso"
        ? catalog.filter((entry) => (draft.aulaSlugs ?? []).includes(entry.slug))
        : draft.contentType === "trilha"
          ? catalog.filter((entry) =>
              (draft.trilhaItens ?? []).some(
                (item) => item.tipo === entry.type && item.slug === entry.slug,
              ),
            )
          : [];
    const bodyText = draft.contentType === "aula" ? JSON.stringify(draft.body) : "";
    const context = [
      draft.titulo,
      draft.resumo,
      bodyText,
      ...selectedEntries.flatMap((entry) => [
        entry.titulo,
        entry.summary,
        entry.category ?? "",
        ...entry.tags,
      ]),
    ].join(" ");
    const contextTokens = suggestionTokens(context);
    const supportedEntries = catalog.filter((entry) =>
      ["aula", "curso", "noticia"].includes(entry.type),
    );
    const collect = (field: "tag" | "category", entries = supportedEntries) => {
      const values = new Map<
        string,
        { value: string; usages: number; types: Set<CatalogEntry["type"]> }
      >();
      for (const entry of entries) {
        const source =
          field === "tag" ? entry.tags : entry.category ? [entry.category] : [];
        for (const rawValue of source) {
          const value = rawValue.trim();
          const key = normalizeTag(value);
          if (!key) continue;
          const current = values.get(key) ?? {
            value,
            usages: 0,
            types: new Set<CatalogEntry["type"]>(),
          };
          current.usages += 1;
          current.types.add(entry.type);
          values.set(key, current);
        }
      }
      return [...values.values()]
        .map((candidate) => ({
          ...candidate,
          score: [...suggestionTokens(candidate.value)].filter((token) =>
            contextTokens.has(token),
          ).length,
          types: [...candidate.types],
        }))
        .map(({ value, usages, types, score }) => ({ value, usages, types, score }));
    };
    const currentTags = new Set(draft.tags.map(normalizeTag));
    const allTags = collect("tag");
    const allCategories = collect("category");
    const allAreas = collect(
      "category",
      catalog.filter((entry) => entry.type === "trilha"),
    );
    const allTechnologies = collect(
      "tag",
      catalog.filter((entry) => entry.type === "projeto"),
    );
    return {
      tags: allTags.filter(
        (suggestion) =>
          suggestion.score > 0 && !currentTags.has(normalizeTag(suggestion.value)),
      ),
      allTags,
      categories: allCategories.filter(
        (suggestion) =>
          suggestion.score > 0 &&
          normalizeTag(suggestion.value) !== normalizeTag(draft.categoria ?? ""),
      ),
      allCategories,
      areas: allAreas.filter(
        (suggestion) =>
          suggestion.score > 0 &&
          normalizeTag(suggestion.value) !== normalizeTag(draft.categoria ?? ""),
      ),
      allAreas,
      technologies: allTechnologies.filter(
        (suggestion) =>
          suggestion.score > 0 &&
          !(draft.tecnologias ?? []).some(
            (technology) => normalizeTag(technology) === normalizeTag(suggestion.value),
          ),
      ),
      allTechnologies,
    };
  }, [
    catalog,
    draft.aulaSlugs,
    draft.body,
    draft.categoria,
    draft.contentType,
    draft.resumo,
    draft.tags,
    draft.tecnologias,
    draft.trilhaItens,
    draft.titulo,
  ]);
  const prerequisiteCandidates = useMemo(
    () => (draft.contentType === "curso" ? [...lessons, ...courses] : lessons),
    [courses, draft.contentType, lessons],
  );
  const prerequisiteStatuses = useMemo(
    () => statusesFor(prerequisiteCandidates, prerequisiteType),
    [prerequisiteCandidates, prerequisiteType],
  );
  const prerequisiteTypes = useMemo(
    () => typesFor(prerequisiteCandidates, prerequisiteStatus),
    [prerequisiteCandidates, prerequisiteStatus],
  );
  useEffect(() => {
    if (prerequisiteStatus && !prerequisiteStatuses.includes(prerequisiteStatus)) {
      setPrerequisiteStatus("");
    }
  }, [prerequisiteStatus, prerequisiteStatuses]);
  useEffect(() => {
    if (
      prerequisiteType &&
      !prerequisiteTypes.includes(prerequisiteType as CatalogEntry["type"])
    ) {
      setPrerequisiteType("");
    }
  }, [prerequisiteType, prerequisiteTypes]);
  const prerequisiteOptions = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase("pt-BR");
    const normalizedQuery = normalize(prerequisiteQuery.trim());
    return prerequisiteCandidates
      .filter((entry) => entry.slug !== draft.slug)
      .filter(
        (entry) =>
          draft.preRequisitos.includes(entry.slug) ||
          ((!normalizedQuery ||
            normalize([entry.titulo, entry.slug, ...entry.tags].join(" ")).includes(
              normalizedQuery,
            )) &&
            (!prerequisiteType || entry.type === prerequisiteType) &&
            (!prerequisiteStatus || entry.status === prerequisiteStatus)),
      )
      .sort((first, second) => {
        const byTitle = first.titulo.localeCompare(second.titulo, "pt-BR", {
          sensitivity: "base",
        });
        if (prerequisiteSort === "title-desc") return -byTitle;
        if (prerequisiteSort === "selected") {
          const firstSelected = draft.preRequisitos.includes(first.slug) ? 1 : 0;
          const secondSelected = draft.preRequisitos.includes(second.slug) ? 1 : 0;
          return secondSelected - firstSelected || byTitle;
        }
        if (prerequisiteSort === "date-desc" || prerequisiteSort === "date-asc") {
          if (!first.publicationDate && !second.publicationDate) return byTitle;
          if (!first.publicationDate) return 1;
          if (!second.publicationDate) return -1;
          const byDate = first.publicationDate.localeCompare(second.publicationDate);
          return byDate === 0
            ? byTitle
            : prerequisiteSort === "date-desc"
              ? -byDate
              : byDate;
        }
        return byTitle;
      });
  }, [
    draft.preRequisitos,
    draft.slug,
    prerequisiteCandidates,
    prerequisiteQuery,
    prerequisiteSort,
    prerequisiteStatus,
    prerequisiteType,
  ]);
  const activePrerequisiteFilters =
    Number(Boolean(prerequisiteType)) +
    Number(Boolean(prerequisiteStatus)) +
    Number(prerequisiteSort !== "title-asc");
  const prerequisitePageSize = 10;
  const prerequisitePageCount = Math.max(
    1,
    Math.ceil(prerequisiteOptions.length / prerequisitePageSize),
  );
  const currentPrerequisitePage = Math.min(prerequisitePage, prerequisitePageCount);
  const paginatedPrerequisiteOptions = prerequisiteOptions.slice(
    (currentPrerequisitePage - 1) * prerequisitePageSize,
    currentPrerequisitePage * prerequisitePageSize,
  );

  useEffect(() => {
    setPrerequisitePage(1);
  }, [
    draft.contentType,
    prerequisiteQuery,
    prerequisiteSort,
    prerequisiteStatus,
    prerequisiteType,
  ]);
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
      !(await confirm({
        eyebrow: "Primeira confirmação",
        title: "Escrever os arquivos no clone?",
        message:
          "Os arquivos revisados serão gravados no clone gerenciado. Nada será enviado ao GitHub nesta etapa.",
        confirmLabel: "Escrever arquivos",
      }))
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
      !(await confirm({
        eyebrow: "Segunda confirmação • publicação",
        title: "Enviar conteúdo para origin/main?",
        message: `Será criado e enviado um commit com a mensagem “${publish.commitMessage}”. O Portal iniciará o deploy após o push.`,
        confirmLabel: "Publicar agora",
        tone: "danger",
      }))
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
        {advancedMode && (
          <div>
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
              Preencher modelo Python
            </button>
          </div>
        )}
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
              <div className="metadata-field wide">
                <div className="metadata-selected-field">
                  <strong>Tecnologias</strong>
                  <div className="metadata-selected-values">
                    {(draft.tecnologias ?? []).map((technology) => (
                      <button
                        type="button"
                        key={technology}
                        onClick={() =>
                          set(
                            "tecnologias",
                            (draft.tecnologias ?? []).filter(
                              (current) =>
                                normalizeTag(current) !== normalizeTag(technology),
                            ),
                          )
                        }
                        title={`Remover a tecnologia ${technology}`}
                      >
                        {technology} <span aria-hidden="true">×</span>
                      </button>
                    ))}
                    {!(draft.tecnologias ?? []).length && (
                      <small>Escolha ou crie tecnologias abaixo.</small>
                    )}
                  </div>
                </div>
                <MetadataSuggestionPanel
                  label="tecnologias"
                  suggestions={metadataSuggestions.technologies}
                  allCandidates={metadataSuggestions.allTechnologies}
                  onApply={(value) =>
                    set(
                      "tecnologias",
                      (draft.tecnologias ?? []).some(
                        (technology) =>
                          normalizeTag(technology) === normalizeTag(value),
                      )
                        ? draft.tecnologias
                        : [...(draft.tecnologias ?? []), value],
                    )
                  }
                  onCreate={(value) =>
                    set(
                      "tecnologias",
                      (draft.tecnologias ?? []).some(
                        (technology) =>
                          normalizeTag(technology) === normalizeTag(value),
                      )
                        ? draft.tecnologias
                        : [...(draft.tecnologias ?? []), value],
                    )
                  }
                />
              </div>
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
          <label className="wide">
            Resumo
            <textarea
              value={draft.resumo}
              onChange={(event) => set("resumo", event.target.value)}
            />
          </label>
          {draft.contentType !== "projeto" && (
            <div className="metadata-field wide">
              <label>
                {draft.contentType === "trilha" ? "Área" : "Categoria"}
                <input
                  value={draft.categoria ?? ""}
                  readOnly
                  placeholder={`Escolha ou crie ${draft.contentType === "trilha" ? "uma área" : "uma categoria"} abaixo`}
                />
              </label>
              {draft.contentType === "trilha" ? (
                <MetadataSuggestionPanel
                  label="áreas"
                  suggestions={metadataSuggestions.areas}
                  allCandidates={metadataSuggestions.allAreas}
                  onApply={(value) => set("categoria", value)}
                  onCreate={(value) => set("categoria", value)}
                />
              ) : (
                <MetadataSuggestionPanel
                  label="categorias"
                  suggestions={metadataSuggestions.categories}
                  allCandidates={metadataSuggestions.allCategories}
                  onApply={(value) => set("categoria", value)}
                  onCreate={(value) => set("categoria", value)}
                />
              )}
            </div>
          )}
          {["aula", "curso", "noticia"].includes(draft.contentType ?? "aula") && (
            <div className="metadata-field wide">
              <div className="metadata-selected-field">
                <strong>Tags</strong>
                <div className="metadata-selected-values">
                  {draft.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() =>
                        set(
                          "tags",
                          draft.tags.filter(
                            (current) => normalizeTag(current) !== normalizeTag(tag),
                          ),
                        )
                      }
                      title={`Remover a tag ${tag}`}
                    >
                      {tag} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  {!draft.tags.length && <small>Escolha ou crie tags abaixo.</small>}
                </div>
              </div>
              <MetadataSuggestionPanel
                label="tags"
                suggestions={metadataSuggestions.tags}
                allCandidates={metadataSuggestions.allTags}
                onApply={(value) =>
                  set(
                    "tags",
                    draft.tags.some((tag) => normalizeTag(tag) === normalizeTag(value))
                      ? draft.tags
                      : [...draft.tags, value],
                  )
                }
                onCreate={(value) =>
                  set(
                    "tags",
                    draft.tags.some((tag) => normalizeTag(tag) === normalizeTag(value))
                      ? draft.tags
                      : [...draft.tags, value],
                  )
                }
              />
            </div>
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
            <>
              <ContentPicker
                title="Aulas do Curso"
                className="course-items-picker"
                candidates={lessons}
                selectedCount={(draft.aulaSlugs ?? []).length}
                isSelected={(entry) => (draft.aulaSlugs ?? []).includes(entry.slug)}
                isUnavailable={(entry) =>
                  draft.status === "publicado" && entry.status !== "publicado"
                }
                onSelectionChange={(entry, selected) =>
                  set(
                    "aulaSlugs",
                    selected
                      ? [...(draft.aulaSlugs ?? []), entry.slug]
                      : (draft.aulaSlugs ?? []).filter((slug) => slug !== entry.slug),
                  )
                }
              />
              {(draft.aulaSlugs ?? []).length > 0 && (
                <section className="trail-order panel course-order">
                  <span className="eyebrow">Ordem do curso</span>
                  <h3>Sequência das aulas</h3>
                  <ol>
                    {(draft.aulaSlugs ?? []).map((slug, index) => (
                      <li key={slug}>
                        {index + 1}. aula: {slug}{" "}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => {
                            const next = [...(draft.aulaSlugs ?? [])];
                            [next[index - 1], next[index]] = [
                              next[index]!,
                              next[index - 1]!,
                            ];
                            set("aulaSlugs", next);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === (draft.aulaSlugs?.length ?? 0) - 1}
                          onClick={() => {
                            const next = [...(draft.aulaSlugs ?? [])];
                            [next[index], next[index + 1]] = [
                              next[index + 1]!,
                              next[index]!,
                            ];
                            set("aulaSlugs", next);
                          }}
                        >
                          ↓
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
          {draft.contentType === "trilha" && (
            <>
              <fieldset className="wide">
                <legend>Itens da Trilha, na ordem de seleção</legend>
                <ContentPicker
                  embedded
                  title="Itens da Trilha"
                  candidates={[...lessons, ...courses]}
                  selectedCount={(draft.trilhaItens ?? []).length}
                  isSelected={(entry) =>
                    (draft.trilhaItens ?? []).some(
                      (item) => item.tipo === entry.type && item.slug === entry.slug,
                    )
                  }
                  isUnavailable={(entry) =>
                    draft.status === "publicado" && entry.status !== "publicado"
                  }
                  onSelectionChange={(entry, selected) =>
                    set(
                      "trilhaItens",
                      selected
                        ? [
                            ...(draft.trilhaItens ?? []),
                            { tipo: entry.type as "aula" | "curso", slug: entry.slug },
                          ]
                        : (draft.trilhaItens ?? []).filter(
                            (item) =>
                              !(item.tipo === entry.type && item.slug === entry.slug),
                          ),
                    )
                  }
                />
              </fieldset>
              {(draft.trilhaItens ?? []).length > 0 && (
                <section className="trail-order panel course-order">
                  <span className="eyebrow">Ordem da trilha</span>
                  <h3>Sequência de itens</h3>
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
                </section>
              )}
            </>
          )}
          {(draft.contentType === "aula" ||
            draft.contentType === "curso" ||
            !draft.contentType) && (
            <fieldset className="wide prerequisite-picker">
              <legend>Pré-requisitos</legend>
              <div className="dependency-search">
                <label className="dependency-search-field">
                  <span>Buscar conteúdo</span>
                  <input
                    type="search"
                    value={prerequisiteQuery}
                    onChange={(event) => setPrerequisiteQuery(event.target.value)}
                    placeholder="Digite o título ou slug"
                  />
                </label>
                <details className="dependency-filter-menu">
                  <summary>
                    Filtros
                    {activePrerequisiteFilters > 0 && (
                      <span>{activePrerequisiteFilters}</span>
                    )}
                  </summary>
                  <div className="dependency-filter-popover">
                    <label>
                      Tipo
                      <select
                        value={prerequisiteType}
                        onChange={(event) => setPrerequisiteType(event.target.value)}
                      >
                        <option value="">Todos</option>
                        {prerequisiteTypes.map((type) => (
                          <option value={type} key={type}>
                            {contentTypeLabel[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Estado
                      <select
                        value={prerequisiteStatus}
                        onChange={(event) => setPrerequisiteStatus(event.target.value)}
                      >
                        <option value="">Todos</option>
                        {prerequisiteStatuses.map((status) => (
                          <option value={status} key={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Ordenar
                      <select
                        value={prerequisiteSort}
                        onChange={(event) => setPrerequisiteSort(event.target.value)}
                      >
                        <option value="title-asc">Título: A–Z</option>
                        <option value="title-desc">Título: Z–A</option>
                        <option value="date-desc">Mais recentes</option>
                        <option value="date-asc">Mais antigos</option>
                        <option value="selected">Selecionados primeiro</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!activePrerequisiteFilters}
                      onClick={() => {
                        setPrerequisiteType("");
                        setPrerequisiteStatus("");
                        setPrerequisiteSort("title-asc");
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                </details>
              </div>
              <p className="dependency-summary">
                {prerequisiteOptions.length
                  ? `Mostrando ${(currentPrerequisitePage - 1) * prerequisitePageSize + 1}–${Math.min(currentPrerequisitePage * prerequisitePageSize, prerequisiteOptions.length)} de ${prerequisiteOptions.length}`
                  : "0 resultados"}{" "}
                • {draft.preRequisitos.length} selecionado(s)
                {prerequisiteQuery && (
                  <button type="button" onClick={() => setPrerequisiteQuery("")}>
                    Limpar busca
                  </button>
                )}
              </p>
              <div className="dependency-grid">
                {paginatedPrerequisiteOptions.map((lesson) => {
                  const checked = draft.preRequisitos.includes(lesson.slug);
                  const unavailable =
                    draft.status === "publicado" && lesson.status !== "publicado";
                  return (
                    <label
                      className={`dependency-card${checked ? " selected" : ""}${unavailable ? " unavailable" : ""}`}
                      key={`${lesson.type}:${lesson.slug}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={unavailable}
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
                      <span className="dependency-card-copy">
                        <strong>{lesson.titulo}</strong>
                        <small>
                          {lesson.slug}
                          {lesson.publicationDate
                            ? ` • ${lesson.publicationDate}`
                            : " • sem data"}
                        </small>
                      </span>
                      <span className="dependency-card-meta">
                        <span className={`badge ${lesson.type}`}>{lesson.type}</span>
                        <span className={`catalog-status ${lesson.status}`}>
                          {lesson.status}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {!prerequisiteOptions.length && (
                  <div className="dependency-empty">
                    Nenhum conteúdo encontrado para essa busca.
                  </div>
                )}
              </div>
              {prerequisitePageCount > 1 && (
                <nav
                  className="dependency-pagination"
                  aria-label="Páginas de pré-requisitos"
                >
                  <button
                    type="button"
                    disabled={currentPrerequisitePage === 1}
                    onClick={() => setPrerequisitePage(currentPrerequisitePage - 1)}
                  >
                    Anterior
                  </button>
                  <div>
                    {Array.from({ length: prerequisitePageCount }, (_, index) => {
                      const page = index + 1;
                      return (
                        <button
                          type="button"
                          className={page === currentPrerequisitePage ? "active" : ""}
                          aria-current={
                            page === currentPrerequisitePage ? "page" : undefined
                          }
                          key={page}
                          onClick={() => setPrerequisitePage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={currentPrerequisitePage === prerequisitePageCount}
                    onClick={() => setPrerequisitePage(currentPrerequisitePage + 1)}
                  >
                    Próxima
                  </button>
                </nav>
              )}
            </fieldset>
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
                ) : block.kind === "video" ? (
                  <p>
                    ▶️ {block.titulo} — <code>{block.url}</code>
                  </p>
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

function AppContent() {
  const confirm = useConfirm();
  const [screen, setScreen] = useState<Screen>("inicio");
  const [environment, setEnvironment] = useState<EnvironmentStatus>();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [tags, setTags] = useState<TagCollectionEntry[]>([]);
  const [categories, setCategories] = useState<CategoryCollectionEntry[]>([]);
  const [areas, setAreas] = useState<AreaCollectionEntry[]>([]);
  const [technologies, setTechnologies] = useState<TechnologyCollectionEntry[]>([]);
  const [drafts, setDrafts] = useState<LessonDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<LessonDraft>();
  const [remoteUrl, setRemoteUrl] = useState(EXPECTED_REMOTE_URL);
  const [autoUpdateReferencesOnDelete, setAutoUpdateReferencesOnDelete] =
    useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState<SidebarItemId[]>([
    ...DEFAULT_SIDEBAR_ORDER,
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const refresh = async () => {
    const [
      environmentResult,
      catalogResult,
      tagsResult,
      categoriesResult,
      areasResult,
      technologiesResult,
      draftsResult,
    ] = await Promise.all([
      window.gearContentStudio.environmentCheck(),
      window.gearContentStudio.listCatalog(),
      window.gearContentStudio.listTags(),
      window.gearContentStudio.listCategories(),
      window.gearContentStudio.listAreas(),
      window.gearContentStudio.listTechnologies(),
      window.gearContentStudio.listDrafts(),
    ]);
    if (environmentResult.ok) {
      setEnvironment(environmentResult.value);
      setAutoUpdateReferencesOnDelete(
        environmentResult.value.autoUpdateReferencesOnDelete,
      );
      setAdvancedMode(environmentResult.value.advancedMode);
      if (environmentResult.value.sidebarOrder.length) {
        setSidebarOrder(environmentResult.value.sidebarOrder);
      }
    }
    if (catalogResult.ok) setCatalog(catalogResult.value);
    if (tagsResult.ok) setTags(tagsResult.value);
    if (categoriesResult.ok) setCategories(categoriesResult.value);
    if (areasResult.ok) setAreas(areasResult.value);
    if (technologiesResult.ok) setTechnologies(technologiesResult.value);
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

  const synchronize = async (): Promise<string | undefined> => {
    setBusy(true);
    setError("");
    try {
      let lastError = "Não foi possível sincronizar.";
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const result = await window.gearContentStudio.synchronize();
        if (result.ok) {
          await refresh();
          return result.value.commit;
        }
        lastError = result.error.message;
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 750));
        }
      }
      setError(`Sincronização falhou após 2 tentativas: ${lastError}`);
      return undefined;
    } catch (caught) {
      setError(
        `Sincronização falhou após 2 tentativas: ${unexpectedErrorMessage(caught)}`,
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const removeCollectionMembership = async (
    kind: "category" | "area" | "technology",
    sourcePath: string,
    value: string,
  ): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const result =
        kind === "technology"
          ? await window.gearContentStudio.updateTag({
              tag: value,
              sourcePath,
              enabled: false,
              scope: "technology",
            })
          : await window.gearContentStudio.updateCategory({
              category: value,
              sourcePath,
              enabled: false,
              scope: kind,
            });
      if (!result.ok) {
        setError(`${result.error.title}: ${result.error.message}`);
        return false;
      }
      await refresh();
      setNotice(
        `Item removido deste conteúdo em origin/main (${result.value.commit.slice(0, 8)}).`,
      );
      return true;
    } catch (caught) {
      setError(
        `Não foi possível atualizar o conteúdo: ${unexpectedErrorMessage(caught)}`,
      );
      return false;
    } finally {
      setBusy(false);
    }
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
        <img className="brand-logo" src={GEAR_LOGO_COMPACT_DATA_URL} alt="GEAR" />
        <div className="brand-copy">
          <strong>GEAR Content Studio</strong>
          <small>
            {environment?.repositoryReady
              ? `main • ${environment.currentCommit?.slice(0, 8)}`
              : "Configuração local"}
          </small>
        </div>
        <button
          className="topbar-sync"
          type="button"
          disabled={busy}
          onClick={() => void synchronize()}
        >
          {busy ? "Sincronizando…" : "Sincronizar"}
        </button>
        <span className="connection">
          <i className={environment?.configured ? "online" : ""} />
          {environment?.configured ? "Git configurado" : "Configuração necessária"}
        </span>
      </header>
      <aside className="sidebar">
        {sidebarOrder.map((value) => (
          <button
            key={value}
            className={screen === value ? "active" : ""}
            onClick={() => (value === "nova-aula" ? createNew() : setScreen(value))}
          >
            {sidebarLabels[value]}
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
          <Home environment={environment} catalog={catalog} onCreate={createNew} />
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
                !(await confirm({
                  eyebrow: "Primeira confirmação",
                  title: "Excluir este conteúdo?",
                  message: `O arquivo ${entry.sourcePath} será removido do GitHub. Você ainda terá uma segunda confirmação antes do envio.`,
                  confirmLabel: "Continuar exclusão",
                  tone: "danger",
                }))
              )
                return false;
              if (
                !(await confirm({
                  eyebrow: "Segunda confirmação • exclusão",
                  title: `Excluir “${entry.titulo}” definitivamente?`,
                  message: environment?.autoUpdateReferencesOnDelete
                    ? "As referências em outros conteúdos também serão removidas automaticamente no mesmo commit."
                    : "Se houver dependências, a operação será bloqueada para proteger o conteúdo relacionado.",
                  confirmLabel: "Excluir do GitHub",
                  tone: "danger",
                }))
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
                const updatedCount = result.value.updatedReferences.length;
                setNotice(
                  `Exclusão confirmada em origin/main (${result.value.commit.slice(0, 8)}).${updatedCount ? ` ${updatedCount} conteúdo(s) dependente(s) também foram atualizados.` : ""} O site será atualizado pelo deploy do Portal.`,
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
        {screen === "tags" && (
          <TagCollection
            tags={tags}
            catalog={catalog}
            onUpdate={async (input) => {
              setBusy(true);
              setError("");
              try {
                const result = await window.gearContentStudio.updateTag(input);
                if (!result.ok) {
                  setError(`${result.error.title}: ${result.error.message}`);
                  return false;
                }
                await refresh();
                setNotice(
                  `Coleção de tags atualizada em origin/main (${result.value.commit.slice(0, 8)}). ${result.value.updatedPaths.length} arquivo(s) MDX foram alterados.`,
                );
                return true;
              } catch (caught) {
                setError(
                  `Não foi possível atualizar a tag: ${unexpectedErrorMessage(caught)}`,
                );
                return false;
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {screen === "categorias" && (
          <CategoryCollection
            categories={categories}
            catalog={catalog}
            onUpdate={async (input) => {
              setBusy(true);
              setError("");
              try {
                const result = await window.gearContentStudio.updateCategory(input);
                if (!result.ok) {
                  setError(`${result.error.title}: ${result.error.message}`);
                  return false;
                }
                await refresh();
                setNotice(
                  `Coleção de categorias atualizada em origin/main (${result.value.commit.slice(0, 8)}). ${result.value.updatedPaths.length} arquivo(s) MDX foram alterados.`,
                );
                return true;
              } catch (caught) {
                setError(
                  `Não foi possível atualizar a categoria: ${unexpectedErrorMessage(caught)}`,
                );
                return false;
              } finally {
                setBusy(false);
              }
            }}
            onRemoveMembership={(sourcePath, area) =>
              removeCollectionMembership("area", sourcePath, area)
            }
          />
        )}
        {screen === "areas" && (
          <CategoryCollection
            categories={areas}
            catalog={catalog}
            collectionLabel="Áreas"
            itemLabel="área"
            itemPlural="áreas"
            onUpdate={async (input) => {
              setBusy(true);
              setError("");
              try {
                const result = await window.gearContentStudio.updateCategory({
                  ...input,
                  scope: "area",
                });
                if (!result.ok) {
                  setError(`${result.error.title}: ${result.error.message}`);
                  return false;
                }
                await refresh();
                setNotice(
                  `Coleção de áreas atualizada em origin/main (${result.value.commit.slice(0, 8)}). ${result.value.updatedPaths.length} arquivo(s) MDX foram alterados.`,
                );
                return true;
              } catch (caught) {
                setError(
                  `Não foi possível atualizar a área: ${unexpectedErrorMessage(caught)}`,
                );
                return false;
              } finally {
                setBusy(false);
              }
            }}
            onRemoveMembership={(sourcePath, technology) =>
              removeCollectionMembership("technology", sourcePath, technology)
            }
          />
        )}
        {screen === "tecnologias" && (
          <CategoryCollection
            categories={technologies}
            catalog={catalog}
            collectionLabel="Tecnologias"
            itemLabel="tecnologia"
            itemPlural="tecnologias"
            onUpdate={async (input) => {
              setBusy(true);
              setError("");
              try {
                const result = await window.gearContentStudio.updateTag({
                  tag: input.category,
                  replacement: input.replacement,
                  scope: "technology",
                });
                if (!result.ok) {
                  setError(`${result.error.title}: ${result.error.message}`);
                  return false;
                }
                await refresh();
                setNotice(
                  `Coleção de tecnologias atualizada em origin/main (${result.value.commit.slice(0, 8)}). ${result.value.updatedPaths.length} arquivo(s) MDX foram alterados.`,
                );
                return true;
              } catch (caught) {
                setError(
                  `Não foi possível atualizar a tecnologia: ${unexpectedErrorMessage(caught)}`,
                );
                return false;
              } finally {
                setBusy(false);
              }
            }}
            onRemoveMembership={(sourcePath, category) =>
              removeCollectionMembership("category", sourcePath, category)
            }
          />
        )}
        {screen === "nova-aula" && activeDraft && (
          <LessonEditor
            key={activeDraft.id}
            initialDraft={activeDraft}
            catalog={catalog}
            advancedMode={advancedMode}
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
                        if (
                          !(await confirm({
                            title: "Excluir rascunho local?",
                            message:
                              "Este rascunho será removido apenas deste computador e não afeta o GitHub.",
                            confirmLabel: "Excluir rascunho",
                            tone: "danger",
                          }))
                        )
                          return;
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
            <label className="setting-option">
              <input
                type="checkbox"
                checked={autoUpdateReferencesOnDelete}
                onChange={(event) =>
                  setAutoUpdateReferencesOnDelete(event.target.checked)
                }
              />
              <span>
                <strong>Atualizar dependências ao excluir</strong>
                <small>
                  Remove automaticamente o slug de aulas, cursos e trilhas que dependem
                  do conteúdo excluído, tudo no mesmo commit.
                </small>
              </span>
            </label>
            <label className="setting-option">
              <input
                type="checkbox"
                checked={advancedMode}
                onChange={(event) => setAdvancedMode(event.target.checked)}
              />
              <span>
                <strong>Modo avançado</strong>
                <small>
                  Exibe o menu de desenvolvimento e ferramentas de teste, como o
                  preenchimento automático do modelo Python.
                </small>
              </span>
            </label>
            <div className="sidebar-order-setting">
              <span>
                <strong>Ordem da barra lateral</strong>
                <small>Use as setas para definir a ordem dos atalhos do app.</small>
              </span>
              <ol>
                {sidebarOrder.map((item, index) => (
                  <li key={item}>
                    <span>{sidebarLabels[item]}</span>
                    <div>
                      <button
                        type="button"
                        aria-label={`Mover ${sidebarLabels[item]} para cima`}
                        disabled={index === 0}
                        onClick={() =>
                          setSidebarOrder((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [
                              next[index]!,
                              next[index - 1]!,
                            ];
                            return next;
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover ${sidebarLabels[item]} para baixo`}
                        disabled={index === sidebarOrder.length - 1}
                        onClick={() =>
                          setSidebarOrder((current) => {
                            const next = [...current];
                            [next[index], next[index + 1]] = [
                              next[index + 1]!,
                              next[index]!,
                            ];
                            return next;
                          })
                        }
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="local-recovery-setting">
              <div>
                <strong>Operação local travada</strong>
                <small>
                  Libera uma ação interrompida e preserva arquivos que não possam ser
                  revertidos com segurança.
                </small>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    !(await confirm({
                      eyebrow: "Recuperação local",
                      title: "Cancelar uma operação local interrompida?",
                      message:
                        "O Studio tentará desfazer somente arquivos temporários seguros e liberará o bloqueio local. Conteúdos publicados não serão apagados.",
                      confirmLabel: "Cancelar operação local",
                      tone: "danger",
                    }))
                  )
                    return;
                  setBusy(true);
                  setError("");
                  try {
                    const result =
                      await window.gearContentStudio.recoverLocalOperation();
                    if (!result.ok) {
                      setError(result.error.message);
                      return;
                    }
                    await refresh();
                    setNotice(
                      result.value.preservedPaths.length
                        ? "Operação local liberada. Alguns arquivos foram preservados para segurança."
                        : "Operação local cancelada e bloqueio liberado.",
                    );
                  } catch (caught) {
                    setError(
                      `Não foi possível cancelar a operação local: ${unexpectedErrorMessage(caught)}`,
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancelar operação local
              </button>
            </div>
            <button
              className="primary"
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await window.gearContentStudio.configure({
                    remoteUrl,
                    autoUpdateReferencesOnDelete,
                    advancedMode,
                    sidebarOrder,
                  });
                  if (!result.ok) {
                    setError(result.error.message);
                    return;
                  }
                  await window.gearContentStudio.setAdvancedMode(advancedMode);
                  await refresh();
                  setScreen("inicio");
                } catch (caught) {
                  setError(
                    `Não foi possível salvar a configuração: ${unexpectedErrorMessage(caught)}`,
                  );
                } finally {
                  setBusy(false);
                }
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

export function App() {
  return (
    <ConfirmProvider>
      <AppContent />
    </ConfirmProvider>
  );
}
