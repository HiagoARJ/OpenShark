//! Macros: biblioteca local e compilação para o report 0x09.

use serde::{Deserialize, Serialize};

use crate::profile::MacroMode;
use crate::report::checksum;

/// Códigos de botão do mouse dentro de uma macro; teclas usam o uso HID.
pub const MOUSE_LEFT: u8 = 0xF1;
pub const MOUSE_RIGHT: u8 = 0xF2;
pub const MOUSE_MIDDLE: u8 = 0xF3;
pub const MOUSE_BACK: u8 = 0xF4;
pub const MOUSE_FORWARD: u8 = 0xF5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MacroKind {
    Down,
    Up,
    /// Movimento relativo do cursor.
    Move,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MacroEvent {
    pub kind: MacroKind,
    pub key: u8,
    /// Atraso depois do evento, em ms.
    pub delay: u16,
    pub x: i16,
    pub y: i16,
}

impl Default for MacroEvent {
    fn default() -> Self {
        MacroEvent { kind: MacroKind::Down, key: 0, delay: 10, x: 0, y: 0 }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Macro {
    pub id: String,
    pub name: String,
    pub events: Vec<MacroEvent>,
}

/// Bytes de um evento (o atraso ≥ 128 ms vira o resto em centenas + um item `[n, 3]`).
fn encode_event(e: &MacroEvent) -> (Vec<u8>, u8) {
    let delay = e.delay;
    let (low, extra) = if delay < 0x80 {
        (delay.max(1) as u8, None)
    } else {
        let low = (delay % 100) as u8;
        (if low == 0 { 1 } else { low }, Some((delay / 100) as u8))
    };
    let mut out = Vec::with_capacity(8);
    let mut count = 0u8;
    match e.kind {
        MacroKind::Move => {
            let (x, y) = (e.x as u16, e.y as u16);
            out.extend_from_slice(&[low, 0xF6, (x >> 8) as u8, x as u8, (y >> 8) as u8, y as u8]);
            count += 3;
        }
        MacroKind::Down | MacroKind::Up => {
            let flag = if e.kind == MacroKind::Down { 0 } else { 0x80 };
            out.extend_from_slice(&[low | flag, e.key]);
            count += 1;
        }
    }
    if let Some(n) = extra {
        out.extend_from_slice(&[n, 3]);
        count += 1;
    }
    (out, count)
}

/// Pacotes 0x09 (131 bytes cada) de uma macro a partir do slot `first`. Quando os eventos não
/// cabem em 98 bytes, o pacote termina com `[slot+1, 0xFE]` e a macro continua no slot seguinte;
/// no máximo `max_slots` slots.
pub fn macro_packets(m: &Macro, first: u8, mode: MacroMode, repeat: u8, max_slots: u8) -> Vec<[u8; 0x83]> {
    let encoded: Vec<(Vec<u8>, u8)> = m.events.iter().map(encode_event).collect();
    let mut packets = Vec::new();
    let mut next = 0usize;
    let mut slot = first;
    loop {
        let mut p = [0u8; 0x83];
        p[0] = 0x09;
        p[1] = 0x83;
        p[2] = slot;
        if next == 0 {
            p[3] = mode.byte();
            p[7] = repeat.max(1);
        }
        let mut len = 0usize;
        let mut count = 0u8;
        let mut done = true;
        while next < encoded.len() {
            let (bytes, c) = &encoded[next];
            if len + bytes.len() > 0x62 {
                done = false;
                break;
            }
            p[29 + len..29 + len + bytes.len()].copy_from_slice(bytes);
            len += bytes.len();
            count += c;
            next += 1;
        }
        let last_slot = packets.len() + 1 >= max_slots as usize;
        if !done && !last_slot {
            p[29 + len] = slot + 1;
            p[29 + len + 1] = 0xFE;
        }
        p[28] = count;
        let sum = checksum(&p[3..0x81]);
        p[0x81] = (sum >> 8) as u8;
        p[0x82] = sum as u8;
        packets.push(p);
        if done || last_slot {
            break;
        }
        slot += 1;
    }
    packets
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evento_simples() {
        let m = Macro {
            events: vec![
                MacroEvent { kind: MacroKind::Down, key: 0x04, delay: 50, ..Default::default() },
                MacroEvent { kind: MacroKind::Up, key: 0x04, delay: 250, ..Default::default() },
            ],
            ..Default::default()
        };
        let p = macro_packets(&m, 1, MacroMode::Count, 1, 4);
        assert_eq!(p.len(), 1);
        assert_eq!(&p[0][..4], &[0x09, 0x83, 0x01, 0x00]);
        assert_eq!(p[0][7], 1);
        assert_eq!(p[0][28], 3);
        assert_eq!(&p[0][29..35], &[50, 0x04, 50 | 0x80, 0x04, 2, 3]);
    }

    #[test]
    fn continua_no_slot_seguinte() {
        let ev = MacroEvent { kind: MacroKind::Down, key: 0x04, delay: 10, ..Default::default() };
        let m = Macro { events: vec![ev; 80], ..Default::default() };
        let p = macro_packets(&m, 5, MacroMode::Count, 1, 4);
        assert_eq!(p.len(), 2);
        assert_eq!(p[1][2], 6);
        // 49 eventos de 2 bytes = 98 bytes; o marcador cai logo depois.
        assert_eq!(p[0][29 + 98], 6);
        assert_eq!(p[0][29 + 99], 0xFE);
    }
}
