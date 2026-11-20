# Arquitetura

```
ui (React)  ──invoke/eventos──▶  src-tauri (app)  ──▶  crates/device (HID)  ──▶  mouse
                                      │                      │
                                      └──────────────────────┴──▶  crates/proto (formato dos pacotes)
```

## crates/proto

Só dados e codificação; não fala com o hardware, então dá para testar tudo sem mouse.

- `models.rs` / `models_gen.rs`: os 18 modelos (código, PID no cabo, botões, recursos).
- `profile.rs`: o perfil (`Profile`), valores de fábrica, validação (`sanitize`) e o catálogo de funções de botão.
- `report.rs`: monta e interpreta os pacotes (DPI, energia, polling, botões) e os eventos do receptor.
- `macros.rs`: biblioteca de macros e a compilação delas em pacotes.
- `dpi_gen.rs`: tabelas de códigos de DPI e de funções de botão.

Os testes comparam os pacotes gerados com bytes lidos de um mouse real.

## crates/device

`Manager::start` cria duas threads:

- **monitor**: refaz a enumeração HID a cada segundo, abre o mouse no cabo ou o receptor e detecta
  quando ele some. Sem aviso do mouse por ~6 s, marca como dormindo.
- **eventos**: lê o canal de avisos do receptor (bateria, troca de DPI, confirmações).

`send` repete o envio até o mouse confirmar; `query` pede e lê um bloco de configuração.
Exemplos: `probe` (só leitura) e `echo` (lê e reenvia os mesmos bytes, sem alterar nada).

## src-tauri

- `store.rs`: perfis por modelo, macros e preferências em `%APPDATA%\OpenShark\dados.json` (gravação atômica).
- `state.rs`: sincroniza ao conectar, aplica mudanças e guarda o que ficou pendente enquanto o mouse dormia.
- `apply.rs`: compara o perfil com o que o mouse já tem e manda só os grupos que mudaram.
- `commands.rs`: comandos chamados pela interface (`snapshot`, `save_profile`, `activate_profile`, …).
- `tray_icon.rs`: desenha o ícone da bandeja conforme a bateria.
- `startup.rs`: entrada "iniciar com o Windows".

Eventos enviados à interface: `device://status`, `device://osd`, `profile://changed`, `apply://result`.

## ui

React 19, Vite, Tailwind 4 e zustand. `api.ts` espelha os tipos do Rust; `store.ts` guarda o estado e
faz a edição otimista do perfil ativo (salva com um pequeno atraso para juntar mudanças seguidas).
Fora do Tauri (`pnpm dev` no navegador), as chamadas caem em `mock.ts`, com dados simulados. Parâmetros
úteis na URL: `?tab=dpi`, `?theme=aurora`, `?state=asleep|none|receiver|wired|unsupported`.

## Como habilitar um modelo novo

1. Confirmar com o diagnóstico (`probe`) que a leitura de DPI e energia funciona e decodifica.
2. Conferir que o pacote de DPI gerado pelo `proto` é igual ao lido do mouse.
3. Marcar `supported: true` em `models_gen.rs` e acrescentar um teste com os bytes reais.
