# Instalação e uso

## Pré-requisitos

- Windows x64;
- Git instalado;
- `git config user.name` e `git config user.email` configurados;
- acesso ao repositório pelo Git Credential Manager ou pela configuração Git já
  existente.

O aplicativo não armazena senha ou token. Node.js não é necessário para abrir,
consultar o catálogo ou usar o validador empacotado. Se o clone gerenciado já
possuir as dependências do Portal, o app também executa o Velite congelado como
gate adicional.

## Instalar

1. Execute `GEAR Content Studio Setup 0.3.1.exe`.
2. Escolha a pasta de instalação.
3. Abra **GEAR Content Studio** pelo menu Iniciar ou atalho.
4. Em **Configurações**, confirme o remoto fixo
   `https://github.com/Tiago1a2a3a/Site_Gear`.
5. Em **Início**, use **Sincronizar agora**.

O clone exclusivo, rascunhos, staging e logs ficam em:

```text
%LOCALAPPDATA%\GEAR Content Studio
```

## Criar e publicar conteúdo

1. Selecione **Novo conteúdo** e escolha Aula, Curso, Trilha, Projeto ou Notícia.
2. Preencha os metadados e recursos próprios do tipo escolhido. Aulas também
   aceitam downloads PDF, TXT e ZIP de até 25 MiB.
   Se nenhuma capa for escolhida, o app usa automaticamente a capa branca
   pública do Portal; ela pode ser substituída por uma imagem selecionada.
3. Revise o preview estrutural e o MDX gerado.
4. Confirme a primeira ação para escrever e validar no clone.
5. Revise os caminhos, o diff staged e a mensagem de commit.
6. Confirme novamente para enviar `HEAD:main` a `origin/main`.

No catálogo, **Editar conteúdo** carrega um MDX publicado. Tipo e slug ficam
travados para impedir renomeações acidentais, mas status, texto, relações e
recursos podem ser atualizados pelo mesmo fluxo de revisão.

**Excluir do Portal** exige duas confirmações, bloqueia conteúdos referenciados e
só funciona para publicações registradas pelo aplicativo. O app confirma o SHA e
a ausência dos arquivos em `origin/main`; a atualização do site depende do
workflow de deploy do repositório.

## Desinstalar

A desinstalação remove o programa, mas preserva por padrão o clone gerenciado e os
rascunhos em `%LOCALAPPDATA%\GEAR Content Studio`. Apague essa pasta manualmente
somente depois de confirmar que nenhum rascunho ou diagnóstico é necessário.
