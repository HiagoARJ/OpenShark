//! Codificação dos feature reports (coleção de usage page 0x0B) e do report de entrada 0x03
//! (coleção 0x0A, "OSD"). Formato dos pacotes em `docs/PROTOCOLO.md`.

use serde::Serialize;

use crate::dpi_table::{BUTTON_FUNCS, DPI_CODES};
use crate::models::Model;
use crate::profile::{Button, DpiStage, Light, Profile};

/// Soma de 16 bits usada no fim de todos os pacotes de configuração (alto, depois baixo).
pub fn checksum(bytes: &[u8]) -> u16 {
    bytes.iter().fold(0u16, |s, &b| s.wrapping_add(b as u16))
}

fn put_sum(p: &mut [u8], range: std::ops::Range<usize>, at: usize) {
    let s = checksum(&p[range]);
    p[at] = (s >> 8) as u8;
    p[at + 1] = s as u8;
}

/// Report 0x0C: mandado antes de uma configuração completa (troca de perfil, restaurar padrão).
pub fn sync_packet() -> [u8; 10] {
    [0x0C, 0x0A, 0x01, 0xFE, 0x01, 0xFE, 0, 0, 0, 0]
}

/// Report 0x04 (56 bytes): DPI, estágio ativo, cores e dois atributos.
pub fn dpi_packet(p: &Profile) -> [u8; 0x38] {
    let mut b = [0u8; 0x38];
    b[0] = 0x04;
    b[1] = 0x38;
    b[2] = 0x01;
    b[3] = p.angle_snap as u8;
    b[4] = p.ripple as u8;
    for (i, s) in p.dpi.iter().take(8).enumerate() {
        let bit = 1u8 << i;
        if s.enabled {
            b[5] |= bit;
        }
        let v = s.index;
        if (221..341).contains(&v) {
            b[6] |= bit;
        }
        if v >= 341 {
            b[7] |= bit;
        }
        if (1..=350).contains(&v) {
            let (code, flag) = DPI_CODES[v as usize - 1];
            b[8 + i] = code;
            b[16 + i] = flag;
        }
        b[25 + i * 3..28 + i * 3].copy_from_slice(&s.color);
    }
    b[24] = p.active_stage + 1;
    b[49] = 0x02;
    put_sum(&mut b, 3..50, 50);
    b
}

/// Report 0x05 (15 bytes): modo de luz, brilho, velocidade, cor, sono e debounce.
pub fn power_packet(p: &Profile) -> [u8; 0x0F] {
    let l = &p.light;
    let deep = p.deep_sleep;
    let mut b = [0u8; 0x0F];
    b[0] = 0x05;
    b[1] = 0x0F;
    b[2] = 0x01;
    b[3] = l.mode << 4;
    b[4] = (deep & 0xF0) | (9u8.wrapping_sub(l.speed) & 0x0F);
    let low = if l.mode == 1 || l.mode == 5 { l.brightness & 0x0F } else { 8 };
    b[5] = (deep << 4) | low;
    b[6..9].copy_from_slice(&l.color);
    b[9] = p.sleep_minutes;
    b[10] = p.debounce;
    put_sum(&mut b, 3..11, 11);
    b
}

/// Report 0x06 (9 bytes): polling. 125 Hz = 8, 250 = 4, 500 = 2, 1000 = 1.
pub fn polling_packet(p: &Profile) -> [u8; 9] {
    let v = match p.polling {
        0 => 8,
        1 => 4,
        2 => 2,
        _ => 1,
    };
    [0x06, 0x09, 0x01, v, !v, 0, 0, 0, 0]
}

/// Os 3 bytes de um botão no report 0x08.
pub fn button_bytes(b: &Button, macro_slot: u8) -> [u8; 3] {
    // Vale a última entrada da tabela com o mesmo id.
    let mut out = [0u8; 3];
    for &(id, b0, b1, b2) in BUTTON_FUNCS.iter() {
        if id == b.func {
            out = [b0, b1, b2];
        }
    }
    match b.func {
        0x10 => out = [out[0], b.modifiers, b.key],
        0x11 => out = [out[0], 0, macro_slot],
        _ => {}
    }
    out
}

/// Report 0x08 (59 bytes): os 18 slots de botão.
pub fn buttons_packet(p: &Profile, model: &Model) -> [u8; 0x3B] {
    let mut b = [0u8; 0x3B];
    b[0] = 0x08;
    b[1] = 0x3B;
    b[2] = 0x01;
    for i in 0..18 {
        let btn = p.buttons.get(i).cloned().unwrap_or_default();
        b[3 + i * 3..6 + i * 3].copy_from_slice(&button_bytes(&btn, model.macro_slot(i)));
    }
    put_sum(&mut b, 3..0x39, 0x39);
    b
}

/// Pedido de leitura: `A0 id len 00 flag`. Depois o host lê o feature 0xA0 até o
/// byte 1 valer 1 e então lê o feature `id`.
pub fn query_request(id: u8, len: u8, flag: u8) -> [u8; 8] {
    [0xA0, id, len, 0, flag, 0, 0, 0]
}

/// Quebra um pacote 0x09 nos 3 blocos de 64 bytes que o dongle aceita.
/// `wireless` muda o cabeçalho do último bloco para `09 0C`, exigido pelo receptor.
pub fn split_macro(packet: &[u8; 0x83], wireless: bool) -> [[u8; 0x40]; 3] {
    let data = &packet[3..3 + 128];
    let mut out = [[0u8; 0x40]; 3];
    for (k, chunk) in out.iter_mut().enumerate() {
        chunk[0] = 0x09;
        chunk[1] = if wireless && k == 2 { 0x0C } else { 0x40 };
        chunk[2] = packet[2];
        chunk[3] = k as u8;
        let from = k * 60;
        let to = (from + 60).min(data.len());
        chunk[4..4 + (to - from)].copy_from_slice(&data[from..to]);
    }
    out
}

/// O que o mouse devolve nos reports 0x04/0x05/0x06.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceConfig {
    pub dpi: Option<(Vec<DpiStage>, u8, bool, bool)>,
    pub power: Option<(Light, u8, u8, u8)>,
    pub polling: Option<u8>,
}

/// Inverso de [`dpi_packet`]: `(estágios, ativo, angle_snap, ripple)`.
pub fn decode_dpi(b: &[u8]) -> Option<(Vec<DpiStage>, u8, bool, bool)> {
    if b.len() < 52 || b[0] != 0x04 || b[1] != 0x38 {
        return None;
    }
    if checksum(&b[3..50]) != u16::from_be_bytes([b[50], b[51]]) {
        return None;
    }
    let stages = (0..8)
        .map(|i| {
            let bit = 1u8 << i;
            let (code, flag) = (b[8 + i], b[16 + i]);
            let mid = b[6] & bit != 0;
            let top = b[7] & bit != 0;
            let index = if code == 0 {
                0
            } else {
                // Busca exata: o índice cujo código, flag e
                // faixa batem; senão o de código mais próximo na mesma faixa.
                let range = |v: u16| ((221..341).contains(&v), v >= 341);
                let mut best = (u16::MAX, 0u16);
                for v in 1..=350u16 {
                    if range(v) != (mid, top) {
                        continue;
                    }
                    let (c, fl) = DPI_CODES[v as usize - 1];
                    let d = (c as i16 - code as i16).unsigned_abs() + if fl == flag { 0 } else { 1000 };
                    if d < best.0 {
                        best = (d, v);
                    }
                }
                best.1
            };
            DpiStage {
                index,
                enabled: b[5] & bit != 0,
                color: [b[25 + i * 3], b[26 + i * 3], b[27 + i * 3]],
            }
        })
        .collect();
    Some((stages, b[24].saturating_sub(1), b[3] != 0, b[4] != 0))
}

/// Inverso de [`power_packet`]: `(luz, sono em min, sono profundo, debounce)`.
pub fn decode_power(b: &[u8]) -> Option<(Light, u8, u8, u8)> {
    if b.len() < 13 || b[0] != 0x05 || b[1] != 0x0F {
        return None;
    }
    if checksum(&b[3..11]) != u16::from_be_bytes([b[11], b[12]]) {
        return None;
    }
    let mode = b[3] >> 4;
    let light = Light {
        mode,
        brightness: if mode == 1 || mode == 5 { (b[5] & 0x0F).clamp(1, 8) } else { 8 },
        speed: 9u8.saturating_sub(b[4] & 0x0F).clamp(4, 8),
        color: [b[6], b[7], b[8]],
    };
    let deep = (b[4] & 0xF0) | (b[5] >> 4);
    Some((light, b[9], deep, b[10]))
}

/// Inverso de [`polling_packet`].
pub fn decode_polling(b: &[u8]) -> Option<u8> {
    if b.len() < 5 || b[0] != 0x06 || b[3] != !b[4] {
        return None;
    }
    Some(match b[3] {
        8 => 0,
        4 => 1,
        2 => 2,
        _ => 3,
    })
}

/// Eventos do report de entrada 0x03: `03 código tipo b3 b4`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum OsdEvent {
    /// Heartbeat a cada ~2 s com o estado da bateria.
    Status { code: u8, battery: u8, charging: bool, full: bool },
    /// O usuário trocou de estágio no botão do mouse (1-based).
    DpiStage { code: u8, stage: u8 },
    Polling { code: u8, polling: u8 },
    /// Confirmação de um pacote mandado pelo receptor (`ok = b3 == 0`).
    Ack { code: u8, ok: bool },
    LightMode { code: u8, mode: u8 },
    Other { code: u8, kind: u8, value: u16 },
}

impl OsdEvent {
    pub fn code(&self) -> u8 {
        match *self {
            OsdEvent::Status { code, .. }
            | OsdEvent::DpiStage { code, .. }
            | OsdEvent::Polling { code, .. }
            | OsdEvent::Ack { code, .. }
            | OsdEvent::LightMode { code, .. }
            | OsdEvent::Other { code, .. } => code,
        }
    }
}

pub fn parse_osd(r: &[u8]) -> Option<OsdEvent> {
    if r.len() < 5 || r[0] != 0x03 {
        return None;
    }
    let (code, kind, b3, b4) = (r[1], r[2], r[3], r[4]);
    Some(match kind {
        0x40 => match b3 {
            2 => OsdEvent::Status { code, battery: 100, charging: false, full: true },
            3 => OsdEvent::Status { code, battery: b4.min(100), charging: true, full: false },
            _ => OsdEvent::Status { code, battery: b4.min(100), charging: false, full: false },
        },
        0x10 => OsdEvent::DpiStage { code, stage: b3 },
        0x20 => OsdEvent::Polling { code, polling: (b3 & 0x0F).wrapping_sub(1) },
        0x50 => OsdEvent::Ack { code, ok: b3 == 0 },
        0x70 => OsdEvent::LightMode { code, mode: b3 >> 4 },
        _ => OsdEvent::Other { code, kind, value: u16::from_le_bytes([b3, b4]) },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Lidos do MS_15 real pelo dongle (pedido A0 + GET_FEATURE), em 2026-11-20.
    const DPI_REAL: [u8; 57] = [
        0x04, 0x38, 0x01, 0x00, 0x01, 0x3f, 0x00, 0x20, 0x12, 0x25, 0x38, 0x4b, 0xbc, 0xc7, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00,
        0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0xff, 0xff, 0x40, 0x00, 0xff, 0xff,
        0xff, 0x02, 0x0f, 0xd4, 0x00, 0x00, 0x00, 0x00, 0x03,
    ];
    const POWER_REAL: [u8; 16] = [
        0x05, 0x0f, 0x01, 0x00, 0x03, 0xa8, 0x00, 0xff, 0x00, 0x01, 0x04, 0x01, 0xaf, 0x00, 0x00, 0xc7,
    ];

    #[test]
    fn pacote_dpi_padrao_igual_ao_lido_do_mouse() {
        let p = Profile::default();
        assert_eq!(&dpi_packet(&p)[..52], &DPI_REAL[..52]);
    }

    #[test]
    fn pacote_energia_padrao_igual_ao_lido_do_mouse() {
        let p = Profile::default();
        assert_eq!(&power_packet(&p)[..13], &POWER_REAL[..13]);
    }

    #[test]
    fn decodifica_o_que_codifica() {
        let (stages, active, angle, ripple) = decode_dpi(&DPI_REAL).unwrap();
        let p = Profile::default();
        assert_eq!(stages, p.dpi);
        assert_eq!((active, angle, ripple), (1, false, true));
        let mut q = Profile::default();
        for (i, s) in q.dpi.iter_mut().enumerate() {
            s.index = [1, 150, 200, 201, 220, 221, 300, 341][i];
            s.enabled = true;
        }
        let back = decode_dpi(&dpi_packet(&q)).unwrap().0;
        for (a, b) in q.dpi.iter().zip(back.iter()) {
            let (ca, fa) = DPI_CODES[a.index as usize - 1];
            let (cb, fb) = DPI_CODES[b.index as usize - 1];
            assert_eq!((ca, fa), (cb, fb), "{} vs {}", a.index, b.index);
        }
        let (light, sleep, deep, debounce) = decode_power(&POWER_REAL).unwrap();
        assert_eq!((light, sleep, deep, debounce), (p.light.clone(), 1, 10, 4));
    }

    #[test]
    fn polling() {
        let mut p = Profile::default();
        for i in 0..4 {
            p.polling = i;
            assert_eq!(decode_polling(&polling_packet(&p)), Some(i));
        }
        assert_eq!(polling_packet(&p), [0x06, 0x09, 0x01, 0x01, 0xFE, 0, 0, 0, 0]);
    }

    #[test]
    fn botoes_padrao() {
        let model = Model::by_number(15).unwrap();
        let p = Profile::default_for(model);
        let b = buttons_packet(&p, model);
        // Esquerdo, direito, meio, ciclo de DPI, voltar, avançar.
        assert_eq!(&b[3..21], &[2, 0, 0, 3, 0, 0, 4, 0, 0, 0x0D, 0, 0, 5, 0, 0, 6, 0, 0]);
        let sum = checksum(&b[3..0x39]);
        assert_eq!(u16::from_be_bytes([b[0x39], b[0x3a]]), sum);
    }

    #[test]
    fn heartbeat() {
        assert_eq!(
            parse_osd(&[0x03, 0x0e, 0x40, 0x01, 0x57]),
            Some(OsdEvent::Status { code: 0x0e, battery: 87, charging: false, full: false })
        );
    }
}
