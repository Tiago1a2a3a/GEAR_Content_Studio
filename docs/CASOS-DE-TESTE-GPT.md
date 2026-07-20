# Casos de teste GPT

Use os casos na ordem abaixo. Cada clique em **Preencher caso GPT** incrementa o
número daquele tipo (`001`, `002`, `003`...).

## Preparação

1. Instale a versão mais recente do GEAR Content Studio.
2. Abra o app e clique em **Sincronizar agora**.
3. Para cada caso, crie um conteúdo, selecione o tipo e clique em
   **Preencher caso GPT**.
4. Na etapa **Recursos e relações**, selecione ao menos uma imagem PNG, JPG ou
   WebP. O app usa a primeira imagem como capa quando o contrato exige.
   Para Aula, selecione também um PDF, TXT ou ZIP para testar downloads.
5. Revise o MDX, prepare as alterações e confirme a publicação.

## Ordem dos casos

1. `aula_gpt_teste_001`
   - Preenche autores, tags, categoria, dificuldade, vídeo, link, repositório,
     comentários e todos os blocos seguros.
2. `curso_gpt_teste_001`
   - Seleciona preferencialmente a Aula GPT publicada e testa capa,
     dificuldade, destaque, tags e `aulaSlugs`.
3. `trilha_gpt_teste_001`
   - Seleciona preferencialmente a Aula e o Curso GPT publicados e testa capa,
     área, ordem, descrição longa e itens mistos.
4. `noticia_gpt_teste_001`
   - Testa capa, autor, categoria, tags, resumo, data e status.
5. `projeto_gpt_teste_001`
   - Testa descrição longa, imagens, vídeo, tecnologias, repositório,
     documentação, destaque e status de projeto.

## O que conferir após cada publicação

- O app volta ao Catálogo.
- O conteúdo não permanece em Rascunhos.
- O item aparece apenas uma vez no Catálogo.
- O arquivo aparece em `main` no GitHub.
- O Portal passa a mostrar o conteúdo após o deploy.
- Uma nova tentativa com o mesmo slug é bloqueada.
- **Editar conteúdo** permite alterar o status e publicar um novo commit sem
  duplicar o arquivo.

Para testar exclusão, remova primeiro a Trilha, depois o Curso e por último a
Aula. Essa ordem evita o bloqueio correto por dependências.
