# Modelos

O receptor 2.4G (`1D57:FA60`) é o mesmo para todos os modelos. A cada ~2 s o mouse manda um aviso
com um **código de modelo**; é por ele que o OpenShark sabe qual mouse está do outro lado. No cabo,
cada modelo aparece com o próprio PID.

Os modelos estão numerados `MS-1` a `MS-18` porque o nome comercial de cada um ainda não foi
mapeado. Se você tem um desses mouses, veja no fim desta página como ajudar.

| Modelo | Código | PID no cabo | Situação | Botões | Estágios de DPI | Iluminação | Distância de levantamento | Motion sync |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MS-1 | `0x85` | `1D57:2055` | Só detecção | ? | 6 | sim | sim | sim |
| MS-2 | `0x4D` | `1D57:201B` | Só detecção | ? | 6 | — | sim | sim |
| MS-3 | `0x10` | `1D57:FA61` | Só detecção | 6 | 6 | sim | — | — |
| MS-4 | `0x55` | `1D57:FA55` | Só detecção | ? | 6 | sim | — | — |
| MS-5 | `0x4E` | `1D57:201C` | Só detecção | ? | 6 | — | sim | sim |
| MS-6 | `0xB1` | `1D57:2111` | Só detecção | 6 | 6 | — | sim | sim |
| MS-7 | `0xBE` | `1D57:211D` | Só detecção | 5 | 6 | — | — | — |
| MS-8 | `0x01` | `1D57:211F` | Só detecção | 5 | 6 | — | sim | sim |
| MS-9 | `0x03` | `1D57:2121` | Só detecção | 5 | 6 | — | — | — |
| MS-10 | `0x07` | `1D57:2125` | Só detecção | 5 | 6 | — | — | — |
| MS-11 | `0x02` | `1D57:2120` | Gravação habilitada | 5 | 6 | — | — | — |
| MS-12 | `0x06` | `1D57:2124` | Só detecção | 5 | 6 | — | sim | sim |
| MS-13 | `0x08` | `1D57:2126` | Só detecção | 5 | 6 | — | sim | sim |
| MS-14 | `0x04` | `1D57:2122` | Gravação habilitada | 5 | 6 | — | — | — |
| MS-15 | `0x0E` | `1D57:212C` | Testado | 5 | 6 | — | — | — |
| MS-16 | `0xE5` | `1D57:2155` | Gravação habilitada | 5 | 6 | — | — | — |
| MS-17 | `0x24` | `1D57:2224` | Gravação habilitada | 5 | 6 | — | — | — |
| MS-18 | `0xEA` | `1D57:215A` | Gravação habilitada | 5 | 6 | — | — | — |

Todos os modelos têm taxa de polling, tempo de resposta das teclas, controle de ondulação, correção
de linha e gestão de energia. "?" em Botões significa que a quantidade exibida ainda não foi mapeada.

## O que cada situação quer dizer

- **Testado**: conferido num mouse real. No MS-15, a leitura de DPI e energia e o envio de DPI, energia e polling
  foram confirmados pelo mouse; a troca de função dos botões e as macros ainda não foram conferidas.
- **Gravação habilitada**: usa as mesmas tabelas de DPI e o mesmo formato de pacotes do MS-15, então
  a edição está liberada, mas ninguém confirmou num mouse real.
- **Só detecção**: o app mostra conexão e bateria, mas bloqueia a edição. Esses modelos codificam o
  DPI de outro jeito, e gravar com a tabela errada poderia deixar o mouse com valores inesperados.

## Como ajudar a mapear um modelo

1. Conecte o mouse pelo receptor e abra o OpenShark: o número `MS-n` aparece no painel lateral.
2. Rode o diagnóstico, que **só lê** e não muda nada no mouse:
   ```powershell
   cargo run -p shark-device --example probe
   ```
3. Abra uma issue com o nome comercial do mouse, o número `MS-n` e a saída do diagnóstico.

Para os modelos com gravação habilitada, vale também contar se as mudanças feitas no app chegaram ao
mouse (DPI, polling, botões e macros).
