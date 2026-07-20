# Portal mínimo

Esta árvore reproduz somente os paths necessários para testes de leitura e
validação. Ela não é uma cópia do site e não deve ser executada como produto.

Os arquivos Git usados nos testes devem ser criados dinamicamente:

1. copiar esta árvore para uma pasta temporária;
2. executar `git init -b main`;
3. criar commit inicial;
4. criar remoto bare temporário;
5. apontar `origin` e fazer push;
6. deixar o app operar em outro clone.

O `package-lock.json` está incluído para permitir instalação reproduzível das
dependências do validador congelado, caso o teste de equivalência use o Velite
real.
