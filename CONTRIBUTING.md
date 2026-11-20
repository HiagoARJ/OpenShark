# Contribuindo

Relatos de teste são a ajuda mais útil agora: só o MS-15 foi conferido em hardware.

## Relatar um teste ou um problema

Abra uma issue com:

- o nome comercial do mouse e o número `MS-n` que o app mostra;
- como ele está conectado (receptor ou cabo) e a versão do Windows;
- o que você mudou no app e o que aconteceu no mouse;
- a saída de `cargo run -p shark-device --example probe` (só leitura).

## Código

```powershell
pnpm --dir ui install
cargo test --workspace
pnpm --dir ui typecheck
```

- Comentários e mensagens em português.
- Mudanças no formato dos pacotes vão com teste em `crates/proto` e atualização de `docs/PROTOCOLO.md`.
- Não inclua imagens, textos ou arquivos de terceiros (por exemplo, do programa oficial da fabricante).

## Segurança do mouse

Ao testar escrita num modelo novo, comece pelo exemplo `echo`, que reenvia ao mouse exatamente o que
leu dele. Só depois teste mudanças de valor, uma por vez.
