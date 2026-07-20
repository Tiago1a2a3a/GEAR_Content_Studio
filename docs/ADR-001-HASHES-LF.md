# ADR-001 — Normalização LF nos hashes do contrato

## Decisão

Antes de calcular SHA-256 dos arquivos textuais congelados do Portal, o app
normaliza `CRLF` para `LF`.

## Motivo

O Git pode materializar o mesmo conteúdo textual com finais de linha diferentes
no Windows. Hashes dos bytes locais criavam falso drift mesmo quando o contrato
semântico era idêntico ao snapshot aprovado.

## Limites

Somente `CRLF` é normalizado. Nenhum outro caractere, espaço, ordem ou conteúdo é
alterado. Mudanças reais continuam colocando a publicação em modo somente leitura.
A decisão foi aprovada para o MVP e possui teste unitário específico.
