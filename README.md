# GEAR Content Studio

Aplicativo desktop local para consultar e gerenciar o conteúdo MDX do Portal
GEAR, com validação, preview, diff e publicação Git segura.

O MVP não incorpora IA generativa. Ele opera somente sobre o clone gerenciado do
repositório aprovado `https://github.com/Tiago1a2a3a/Site_Gear`. Cria e edita
Aulas, Cursos, Trilhas, Projetos e Notícias; publica em `origin/main` após duas
confirmações e só exclui conteúdo cuja criação tenha sido registrada pelo app.

## Instalação e uso

O instalador x64 fica em `dist/GEAR Content Studio Setup 0.4.0.exe`. Consulte:

- [Instalação e uso](docs/INSTALACAO-E-USO.md)
- [Segurança e recuperação](docs/SEGURANCA-E-RECUPERACAO.md)
- [Normalização dos hashes de contrato](docs/ADR-001-HASHES-LF.md)

Em **Configurações**, a opção **Atualizar dependências ao excluir** permite
remover automaticamente referências ao conteúdo excluído em aulas, cursos e
trilhas. As alterações são validadas e publicadas no mesmo commit da exclusão.

## Desenvolvimento

Requer Windows, Node.js 24, npm 11 e Git configurado.

```powershell
npm install
npm run dev
```

## Validação

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
npm run dist:win
```

O aplicativo mantém seu clone em `%LOCALAPPDATA%\GEAR Content Studio\repository`.
Ele nunca usa um clone cotidiano e nunca armazena credenciais.

`graphify-out/` contém o grafo estrutural local usado para auditar arquitetura e
relações do código. Ele não faz parte do instalador.
