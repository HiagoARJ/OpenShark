//! Os 18 modelos conhecidos, numerados `MS-1` … `MS-18`.
//!
//! Todos usam o mesmo receptor 2.4G (`1D57:FA60`); o modelo do outro lado do receptor é
//! identificado pelo byte 1 do report de entrada 0x03 (o "heartbeat" que o mouse manda a cada
//! 2 s). Ligado por cabo, o mouse aparece com o próprio PID (`wired_pid`).

use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    /// Número do modelo (`MS-<n>`).
    pub number: u8,
    /// Código enviado pelo receptor no byte 1 do report 0x03.
    pub code: u8,
    /// PID quando ligado por cabo (VID 1D57).
    pub wired_pid: u16,
    /// Codificadores verificados (mesmas tabelas do MS_15). Os demais só são detectados.
    pub supported: bool,
    /// Slots de botão exibidos, na ordem dos números desenhados na imagem do mouse.
    pub buttons: &'static [usize],
    /// Função padrão (id interno) de cada um dos 18 slots.
    pub default_buttons: [u8; 18],
    pub dpi_stages: u8,
    pub light: bool,
    pub light_modes: u8,
    pub lift_off: bool,
    pub debounce: bool,
    pub ripple: bool,
    pub angle_snap: bool,
    pub motion_sync: bool,
    pub power: bool,
    pub polling: bool,
}

include!("models_gen.rs");

pub const VID: u16 = 0x1D57;
pub const DONGLE_PID: u16 = 0xFA60;

impl Model {
    pub fn by_code(code: u8) -> Option<&'static Model> {
        MODELS.iter().find(|m| m.code == code)
    }

    pub fn by_wired_pid(pid: u16) -> Option<&'static Model> {
        MODELS.iter().find(|m| m.wired_pid == pid)
    }

    pub fn by_number(number: u8) -> Option<&'static Model> {
        MODELS.iter().find(|m| m.number == number)
    }

    /// Primeiro slot de macro de cada botão.
    /// Cada macro pode ocupar até 4 slots consecutivos; 0 = o botão não aceita macro.
    pub fn macro_slot(&self, button: usize) -> u8 {
        const A: [u8; 6] = [1, 5, 9, 0, 13, 17];
        const B: [u8; 6] = [1, 5, 9, 13, 17, 21];
        let table = if matches!(self.number, 16..=18) { &B } else { &A };
        table.get(button).copied().unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codigos_unicos() {
        for (i, a) in MODELS.iter().enumerate() {
            for b in &MODELS[i + 1..] {
                assert_ne!(a.code, b.code);
                assert_ne!(a.wired_pid, b.wired_pid);
            }
        }
        assert_eq!(Model::by_code(0x0E).unwrap().number, 15);
    }
}
