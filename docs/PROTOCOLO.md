# Protocolo HID

Formato dos pacotes trocados com os mouses compatíveis, pelo receptor 2.4G `1D57:FA60` ou pelo cabo.
Conferido em hardware com o MS-15 pelo receptor; o que não foi conferido está marcado.

## Identificação

- Todos os modelos usam o mesmo receptor, `1D57:FA60`. No cabo, cada um tem o próprio PID
  (tabela em `crates/proto/src/models_gen.rs`; o MS-15 é `1D57:212C`).
- Coleções HID do receptor (interface 2): `0x01/0x80` (system control), `0x0C/0x01` (consumer),
  **`0x0A`** (report de entrada 0x03, 4 bytes) e **`0x0B`** (feature reports 0x04 a 0x0C, 0x10, 0x22, 0xA0).
- O modelo do outro lado do receptor vem no byte 1 de cada report 0x03:
  `85 4D 10 55 4E B1 BE 01 03 07 02 06 08 04 0E E5 24 EA` para MS-1 a MS-18.

## Eventos (report 0x03, coleção 0x0A)

`03 <modelo> <tipo> <b3> <b4>`

| tipo | significado |
| --- | --- |
| 0x40 | heartbeat a cada ~2 s: `b3` = 1 na bateria (`b4` = %), 2 = carga completa, 3 = carregando |
| 0x10 | estágio de DPI trocado no mouse (`b3`, a partir de 1) |
| 0x20 | polling (`b3 & 0x0F` menos 1) |
| 0x50 | confirmação de um feature report mandado pelo receptor (`b3 == 0` = ok) |
| 0x70 | modo de luz (`b3 >> 4`) |

Em repouso o mouse para de mandar heartbeat e não atende pedidos até ser mexido.

## Escrita

Feature reports na coleção 0x0B; o primeiro byte é o report ID. No cabo: até 5 tentativas com
200 ms. Pelo receptor: repetir a cada 500 ms (até 10 vezes) até chegar o evento 0x50.
As somas de verificação são a soma de 16 bits dos bytes indicados, gravada byte alto e depois baixo.

| report | tamanho | conteúdo |
| --- | --- | --- |
| `0C` | 10 | `0C 0A 01 FE 01 FE 00 00 00 00`, antes de uma configuração completa |
| `04` | 56 | `04 38 01`, correção de linha, ondulação, máscara de estágios ativos, máscara "faixa média" (índices 221 a 340), máscara "faixa alta" (341 ou mais), 8 códigos de DPI, 8 flags, estágio ativo (a partir de 1), 8 cores RGB, `02`, soma(3..49) |
| `05` | 15 | `05 0F 01`, modo<<4, `(sono profundo & F0) | (9 - velocidade)`, `(sono profundo << 4) | brilho`, RGB, sono (min), tempo de resposta (ms), soma(3..10) |
| `06` | 9 | `06 09 01 v ~v`, com v = 8/4/2/1 para 125/250/500/1000 Hz |
| `08` | 59 | `08 3B 01` + 18 botões de 3 bytes + soma(3..56) |
| `09` | 131 | macro (abaixo), mandada em 3 blocos `09 40 slot k` + 60 bytes |

Conferidos em hardware: `04`, `05` e `06` (lidos do mouse e reenviados com confirmação). Os reports
`08` e `09` ainda não foram conferidos em hardware.

### DPI

O valor guardado é o índice do controle: 1 a 200 valem 50·i DPI; 201 a 350 valem 10000 + 100·(i−200).
Cada índice vira um código do sensor mais uma flag, pela tabela em `crates/proto/src/dpi_gen.rs`.
O pacote gerado para o perfil de fábrica é idêntico, byte a byte, ao que o MS-15 devolve na leitura
(teste `pacote_dpi_padrao_igual_ao_lido_do_mouse`).

### Botões

Cada um dos 18 slots leva 3 bytes: `01` desligado, `02` esquerdo, `03` direito, `04` meio, `05`
voltar, `06` avançar, `07` clique duplo, `0D/0E/0F` DPI ciclo/+/−, `11 mod tecla` atalho de teclado
(mod: 1 Ctrl, 2 Shift, 4 Alt, 8 Win; tecla = uso HID), `12 00 slot` macro. A lista completa está em
`BUTTON_FUNCS` (`crates/proto/src/dpi_gen.rs`).

### Macros

Pacote `09 83 slot modo 00 00 00 repetições`, contagem de itens no byte 28 e eventos a partir do
byte 29 (até 98 bytes), soma(3..128) nos bytes 129 e 130. Eventos: `[atraso | 0x80 se soltar, tecla]`;
movimento `[atraso, F6, xh, xl, yh, yl]`; atrasos de 128 ms ou mais viram `atraso % 100` mais um item
`[atraso / 100, 03]`. Se não couber, o pacote termina com `[slot+1, FE]` e continua no slot seguinte.
Primeiro slot por botão: `1, 5, 9, 0, 13, 17` (MS-11/14/15) ou `1, 5, 9, 13, 17, 21` (MS-16/17/18).
Botões do mouse dentro da macro: `F1` esquerdo, `F2` direito, `F3` meio, `F4` voltar, `F5` avançar.

## Leitura

Mandar `A0 id len 00 flag 00 00 00` como feature; ler o feature `A0` até o byte 1 valer 1 e então ler
o feature `id`. Funciona para `04` (DPI) e `05` (energia) com o mouse acordado; a leitura de `06`
(polling) ainda não foi confirmada. Os botões não têm leitura.
