# Lista de falhas

Use este arquivo para registrar problemas encontrados durante os testes do MVP.

## Pendentes

### FALHA-001 — Slug automático captura somente a primeira letra

- **Título:** Slug automático trava na primeira letra digitada.
- **Data:** 2026-07-20
- **Etapa/tela:** Nova Aula → Informações → Título/Slug.
- **Como reproduzir:** Digitar `MEU NOME E TIAGO` letra por letra no campo Título.
- **Resultado esperado:** O slug deve acompanhar o título e resultar em `meu-nome-e-tiago`.
- **Resultado atual:** Após digitar a primeira letra, o slug fica `m` e não continua sendo atualizado. Ao colar o texto completo, o slug é gerado corretamente.
- **Impacto:** médio
- **Correção aplicada:** o slug agora acompanha a digitação enquanto não houver edição manual do campo Slug. Foi coberto por teste E2E.
- **Status:** corrigida

### FALHA-006 — Após excluir um item, não é possível criar ou escrever

- **Título:** A exclusão de um item pode deixar o app bloqueado para novas criações e edições.
- **Data:** 2026-07-20
- **Etapa/tela:** Catálogo/Nova Aula, após excluir um item.
- **Como reproduzir:** Excluir um item e tentar criar uma nova Aula ou escrever em um rascunho. A falha também voltou a ocorrer ao solicitar a publicação de uma Aula.
- **Resultado esperado:** A exclusão deve terminar normalmente e o app deve continuar permitindo criar e editar.
- **Resultado atual:** Depois da exclusão, o app não permite criar nem escrever mais. A causa ainda não foi identificada.
- **Informação adicional necessária:** mensagem exibida, detalhes do diagnóstico ou captura de tela do erro.
- **Impacto:** crítico
- **Observação:** O bloqueio desapareceu sozinho em uma ocorrência e voltou a acontecer ao iniciar o fluxo de publicação. Também foi observado após minimizar a janela. Enquanto o usuário veio relatar o problema, o app voltou a funcionar sem uma ação explícita.
- **Correção aplicada:** falhas no preflight de `confirmWrite` agora limpam o journal/lock da operação de revisão, evitando que uma tentativa interrompida bloqueie novas escritas. O caminho foi coberto por integração.
- **Status:** corrigida; monitorar em uso real

### FALHA-005 — Rascunho local só aparece após fechar o aplicativo

- **Título:** O autosave não fica visível imediatamente na lista de rascunhos.
- **Data:** 2026-07-20
- **Etapa/tela:** Nova Aula → Rascunhos.
- **Como reproduzir:** Editar uma Aula, sair ou navegar até Rascunhos sem fechar o aplicativo e verificar a lista.
- **Resultado esperado:** O rascunho deve ser persistido e aparecer na lista enquanto o aplicativo continua aberto.
- **Resultado atual:** O rascunho só aparece como salvo localmente depois que a aplicação é fechada e aberta novamente.
- **Impacto:** alto
- **Correção aplicada:** rascunhos locais incompletos agora são aceitos pelo autosave, a lista é atualizada imediatamente e a edição é persistida ao sair/minimizar.
- **Status:** corrigida

### FALHA-004 — Campos inválidos não exibem mensagem clara

- **Título:** A interface não informa adequadamente quando uma entrada é inválida.
- **Data:** 2026-07-20
- **Etapa/tela:** Nova Aula, durante o preenchimento ou revisão.
- **Como reproduzir:** Informar um valor inválido em algum campo e tentar continuar ou revisar a Aula.
- **Resultado esperado:** Mostrar uma mensagem clara indicando o campo inválido e o formato esperado, por exemplo: `Slug inválido. Use letras minúsculas, números e hífens.`
- **Resultado atual:** A entrada é rejeitada ou a operação não avança, mas não aparece uma mensagem explícita informando que o valor está inválido.
- **Impacto:** alto
- **Correção aplicada:** erros agora exibem título e mensagem específica da validação na interface.
- **Status:** corrigida

## Melhorias solicitadas

### MELHORIA-001 — Alterar status da Aula

- **Solicitação:** Permitir mudar o status de uma Aula entre `publicado` e `rascunho`.
- **Contexto:** O formulário de Nova Aula já permite escolher o status inicial, mas o catálogo existente é somente leitura e não permite alterar uma Aula já criada.
- **Impacto desejado:** facilitar a gestão editorial do ciclo de vida das Aulas.
- **Status:** sugestão para etapa futura

### MELHORIA-002 — Reordenar blocos por arrastar e soltar

- **Solicitação:** Permitir segurar um bloco do editor e arrastá-lo para outra posição.
- **Comportamento desejado:** Exibir uma área de destino durante o arraste e atualizar a ordem sem perder o conteúdo do bloco.
- **Contexto:** Atualmente a ordem pode ser alterada somente pelos controles de mover para cima ou para baixo.
- **Impacto desejado:** tornar a edição de Aulas mais rápida e intuitiva.
- **Status:** sugestão para etapa futura

### FALHA-003 — Formatação visual ruim nos cards do catálogo

- **Título:** O card do catálogo apresenta quebras e relações com formatação inadequada.
- **Data:** 2026-07-20
- **Etapa/tela:** Catálogo → detalhe de uma Aula.
- **Como reproduzir:** Abrir o catálogo e selecionar uma Aula com caminho de origem longo e relações de dependência.
- **Resultado esperado:** O caminho deve quebrar de forma legível, sem prejudicar o layout; as relações devem aparecer separadas e com espaçamento consistente.
- **Resultado atual:** O caminho `src/content/aprendizado/aulas/documentacao-projetos.mdx` quebra de forma visualmente ruim, e os itens em “Usado por” aparecem colados, como `curso:... , trilha:...`.
- **Evidência:** imagem enviada pelo usuário em 2026-07-20.
- **Impacto:** médio
- **Correção aplicada:** caminhos longos agora quebram de forma segura e relações aparecem como itens separados.
- **Status:** corrigida

### FALHA-002 — Sair de Nova Aula perde a edição atual

- **Título:** A edição da Aula é perdida ao sair da tela antes de concluir.
- **Data:** 2026-07-20
- **Etapa/tela:** Nova Aula, durante o preenchimento do formulário/editor.
- **Como reproduzir:** Começar a preencher uma Aula e clicar em outra seção do menu antes de publicar ou salvar manualmente.
- **Resultado esperado:** O rascunho deve permanecer recuperável ou o app deve pedir confirmação antes de sair.
- **Resultado atual:** Ao sair de Nova Aula, os dados editados deixam de aparecer quando a tela é reaberta.
- **Impacto:** alto
- **Correção aplicada:** o estado do rascunho é sincronizado com a lista local durante a edição e salvo no ciclo de saída da tela.
- **Status:** corrigida

## Formato dos registros

Para cada falha, registrar:

- **Título:**
- **Data:**
- **Etapa/tela:**
- **Como reproduzir:**
- **Resultado esperado:**
- **Resultado atual:**
- **Impacto:** baixo, médio ou alto
- **Status:** pendente, em correção, corrigida ou aguardando decisão
