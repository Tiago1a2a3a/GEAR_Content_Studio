# Segurança e recuperação

## Limites de segurança

- renderer isolado, sem `require`, `process`, Node, Git ou filesystem;
- preload expõe somente métodos IPC nomeados e tipados;
- argumentos Git são separados e executados com `shell: false`;
- remoto e branch estão limitados ao Portal aprovado e a `main`;
- escrita limitada aos cinco tipos de conteúdo previstos e aos seus recursos;
- exclusão limitada a publicações registradas pelo próprio aplicativo ou a
  conteúdos legados com a assinatura exata de commit gerada pela versão 0.1.0;
- caminhos são confinados e junctions/symlinks externos são rejeitados;
- preview estrutural não executa MDX;
- contrato congelado é conferido antes da escrita;
- logs passam por redaction e rotacionam em cinco arquivos de até 2 MiB.

## Falhas antes do commit

Cada publicação possui lock e journal com estado, caminhos relativos, backups de
arquivos alterados e hash dos arquivos criados. Em uma falha anterior ao stage,
o app restaura alterações e remove somente arquivos registrados pela operação
cujo conteúdo não mudou. O rascunho permanece. Uma exclusão que falha antes do
commit restaura os caminhos rastreados a partir do commit atual.

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
