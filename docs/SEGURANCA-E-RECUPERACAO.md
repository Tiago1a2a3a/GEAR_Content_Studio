# Segurança e recuperação

## Limites de segurança

- renderer isolado, sem `require`, `process`, Node, Git ou filesystem;
- preload expõe somente métodos IPC nomeados e tipados;
- argumentos Git são separados e executados com `shell: false`;
- remoto e branch estão limitados ao Portal aprovado e a `main`;
- escrita limitada a uma Aula nova e suas imagens;
- caminhos são confinados e junctions/symlinks externos são rejeitados;
- preview estrutural não executa MDX;
- contrato congelado é conferido antes da escrita;
- logs passam por redaction e rotacionam em cinco arquivos de até 2 MiB.

## Falhas antes do commit

Cada operação possui lock e journal com estado, caminhos relativos e hash dos
arquivos criados. Em uma falha anterior ao stage, o app remove somente arquivos
registrados pela operação e cujo conteúdo não mudou. O rascunho permanece.

Se o app for encerrado durante uma operação, a próxima abertura verifica se o PID
anterior ainda existe e pede confirmação antes de liberar um lock órfão. Arquivos
alterados, staged ou commitados são preservados para inspeção manual.

## Falhas depois do commit

Se `origin/main` mudar após o commit local ou o push for rejeitado:

- não há force-push nem resolução automática;
- o commit local e o rascunho são preservados;
- uma nova publicação fica bloqueada enquanto o clone não estiver limpo;
- inspecione o clone em
  `%LOCALAPPDATA%\GEAR Content Studio\repository` antes de qualquer ação manual.

Nunca use `git reset --hard`, `git clean`, `git restore` ou remoção ampla para
“corrigir” o clone. Preserve uma cópia do rascunho e peça revisão técnica.

## Diagnóstico

Os logs ficam em `%LOCALAPPDATA%\GEAR Content Studio\logs`. Mensagens da interface
podem fornecer um `detailsId`. O diagnóstico é redigido para remover credenciais,
tokens e URLs autenticadas; ainda assim, revise-o antes de compartilhar.
