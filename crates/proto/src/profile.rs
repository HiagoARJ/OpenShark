//! Perfil de configuração do mouse, salvo em JSON.

use serde::{Deserialize, Serialize};

use crate::models::Model;

/// Velocidades de polling do report 0x06, na ordem dos botões da interface.
pub const POLLING_HZ: [u16; 4] = [125, 250, 500, 1000];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DpiStage {
    /// Índice do slider (1..=350): 1..=200 → 50·i DPI; 201..=350 → 10000 + 100·(i−200) DPI.
    pub index: u16,
    pub enabled: bool,
    pub color: [u8; 3],
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Light {
    pub mode: u8,
    /// 1..=8
    pub brightness: u8,
    /// 4..=8
    pub speed: u8,
    pub color: [u8; 3],
}

impl Default for Light {
    fn default() -> Self {
        Light { mode: 0, brightness: 8, speed: 6, color: [0x00, 0xFF, 0x00] }
    }
}

/// Como a macro de um botão se repete (diálogo "Selecionar uma macro").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum MacroMode {
    /// Toca `repeat` vezes.
    #[default]
    Count,
    /// Repete até qualquer tecla ser pressionada.
    UntilKey,
    /// Repete enquanto o botão estiver pressionado.
    WhileHeld,
}

impl MacroMode {
    pub fn byte(self) -> u8 {
        match self {
            MacroMode::Count => 0,
            MacroMode::UntilKey => 1,
            MacroMode::WhileHeld => 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Button {
    /// Id interno da função (catálogo em [`FUNCTIONS`]).
    pub func: u8,
    /// Atalho personalizado (`func == 0x10`): uso HID da tecla e máscara de modificadores.
    pub key: u8,
    pub modifiers: u8,
    /// Macro atribuída (`func == 0x11`): id da macro na biblioteca.
    pub macro_id: Option<String>,
    pub macro_mode: MacroMode,
    pub macro_repeat: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// Sempre 8 estágios (o pacote tem 8); o modelo diz quantos aparecem.
    pub dpi: Vec<DpiStage>,
    /// Estágio ativo, 0-based.
    pub active_stage: u8,
    /// Índice em [`POLLING_HZ`].
    pub polling: u8,
    /// 0 = 1 mm, 1 = 2 mm (só modelos com LOD).
    pub lift_off: u8,
    pub ripple: bool,
    pub angle_snap: bool,
    pub motion_sync: bool,
    pub light: Light,
    /// Minutos até dormir (1..=60).
    pub sleep_minutes: u8,
    /// Sono profundo (1..=60).
    pub deep_sleep: u8,
    /// Tempo de resposta das teclas em ms (2..=25).
    pub debounce: u8,
    /// 18 slots, na ordem interna do firmware.
    pub buttons: Vec<Button>,
}

const DEFAULT_COLORS: [[u8; 3]; 8] = [
    [0xFF, 0x00, 0x00],
    [0x00, 0xFF, 0x00],
    [0x00, 0x00, 0xFF],
    [0xFF, 0xFF, 0x00],
    [0x00, 0xFF, 0xFF],
    [0xFF, 0x00, 0xFF],
    [0xFF, 0x40, 0x00],
    [0xFF, 0xFF, 0xFF],
];
/// Índices padrão: 800, 1600, 2400, 3200, 8000, 25000 DPI.
const DEFAULT_INDEX: [u16; 8] = [16, 32, 48, 64, 160, 350, 0, 0];

impl Default for Profile {
    fn default() -> Self {
        Profile::default_for(Model::by_number(15).expect("MS_15"))
    }
}

impl Profile {
    /// Valores de fábrica ("Restaurar padrão").
    pub fn default_for(model: &Model) -> Profile {
        let dpi = (0..8)
            .map(|i| DpiStage {
                index: DEFAULT_INDEX[i],
                enabled: i < model.dpi_stages as usize,
                color: DEFAULT_COLORS[i],
            })
            .collect();
        let buttons = model
            .default_buttons
            .iter()
            .map(|&func| Button { func, macro_repeat: 1, ..Button::default() })
            .collect();
        Profile {
            id: String::new(),
            name: String::new(),
            dpi,
            active_stage: 1,
            polling: 3,
            lift_off: 0,
            ripple: true,
            angle_snap: false,
            motion_sync: true,
            light: Light::default(),
            sleep_minutes: 1,
            deep_sleep: 10,
            debounce: 4,
            buttons,
        }
    }

    /// Corrige valores fora das faixas (perfis importados, arquivos antigos).
    pub fn sanitize(&mut self, model: &Model) {
        let base = Profile::default_for(model);
        self.dpi.resize(8, DpiStage { index: 0, enabled: false, color: [0xFF; 3] });
        for (i, s) in self.dpi.iter_mut().enumerate() {
            if s.index > 350 || (s.index == 0 && i < model.dpi_stages as usize) {
                s.index = base.dpi[i].index;
            }
        }
        if self.active_stage as usize >= model.dpi_stages.max(1) as usize {
            self.active_stage = 0;
        }
        if self.polling > 3 {
            self.polling = 3;
        }
        self.lift_off = self.lift_off.min(1);
        self.light.brightness = self.light.brightness.clamp(1, 8);
        self.light.speed = self.light.speed.clamp(4, 8);
        self.sleep_minutes = self.sleep_minutes.clamp(1, 60);
        self.deep_sleep = self.deep_sleep.clamp(1, 60);
        self.debounce = self.debounce.clamp(2, 25);
        if self.buttons.len() != 18 {
            self.buttons.resize(18, Button::default());
            for (b, &func) in self.buttons.iter_mut().zip(model.default_buttons.iter()) {
                if b.func == 0 && b.macro_id.is_none() {
                    b.func = func;
                }
            }
        }
        for b in &mut self.buttons {
            b.macro_repeat = b.macro_repeat.max(1);
        }
    }
}

/// Índice de slider → DPI exibido.
pub fn index_to_dpi(index: u16) -> u32 {
    match index {
        0 => 0,
        1..=200 => index as u32 * 50,
        _ => 10_000 + (index as u32 - 200) * 100,
    }
}

/// DPI → índice de slider mais próximo (passos de 50 até 10000 e de 100 depois).
pub fn dpi_to_index(dpi: u32) -> u16 {
    let dpi = dpi.clamp(50, 25_000);
    if dpi <= 10_000 {
        ((dpi + 25) / 50).clamp(1, 200) as u16
    } else {
        (200 + (dpi - 10_000 + 50) / 100).min(350) as u16
    }
}

/// Grupos de funções de botão, para o menu da interface.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FuncGroup {
    Mouse,
    Dpi,
    Media,
    Browser,
    System,
    Shortcut,
    Special,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FuncInfo {
    pub id: u8,
    pub name: &'static str,
    pub group: FuncGroup,
}

const fn f(id: u8, name: &'static str, group: FuncGroup) -> FuncInfo {
    FuncInfo { id, name, group }
}

/// Funções que um botão pode receber.
pub const FUNCTIONS: &[FuncInfo] = &[
    f(0x01, "Clique esquerdo", FuncGroup::Mouse),
    f(0x02, "Clique direito", FuncGroup::Mouse),
    f(0x03, "Botão do meio", FuncGroup::Mouse),
    f(0x04, "Avançar", FuncGroup::Mouse),
    f(0x05, "Voltar", FuncGroup::Mouse),
    f(0x09, "Clique duplo", FuncGroup::Mouse),
    f(0x0A, "Botão de disparo", FuncGroup::Mouse),
    f(0x16, "Mira fácil", FuncGroup::Mouse),
    f(0x0B, "Rolar para cima", FuncGroup::Mouse),
    f(0x0C, "Rolar para baixo", FuncGroup::Mouse),
    f(0x0D, "Rolar para a esquerda", FuncGroup::Mouse),
    f(0x0E, "Rolar para a direita", FuncGroup::Mouse),
    f(0x06, "Ciclo de DPI", FuncGroup::Dpi),
    f(0x07, "DPI +", FuncGroup::Dpi),
    f(0x08, "DPI −", FuncGroup::Dpi),
    f(0x40, "Player de mídia", FuncGroup::Media),
    f(0x41, "Reproduzir / pausar", FuncGroup::Media),
    f(0x42, "Parar", FuncGroup::Media),
    f(0x43, "Faixa anterior", FuncGroup::Media),
    f(0x44, "Próxima faixa", FuncGroup::Media),
    f(0x45, "Volume +", FuncGroup::Media),
    f(0x46, "Volume −", FuncGroup::Media),
    f(0x47, "Mudo", FuncGroup::Media),
    f(0x50, "Página inicial", FuncGroup::Browser),
    f(0x51, "Favoritos", FuncGroup::Browser),
    f(0x52, "Avançar (navegador)", FuncGroup::Browser),
    f(0x53, "Voltar (navegador)", FuncGroup::Browser),
    f(0x54, "Parar carregamento", FuncGroup::Browser),
    f(0x55, "Atualizar", FuncGroup::Browser),
    f(0x56, "Pesquisar", FuncGroup::Browser),
    f(0x57, "E-mail", FuncGroup::System),
    f(0x58, "Calculadora", FuncGroup::System),
    f(0x59, "Este computador", FuncGroup::System),
    f(0x20, "Recortar", FuncGroup::Shortcut),
    f(0x21, "Copiar", FuncGroup::Shortcut),
    f(0x22, "Colar", FuncGroup::Shortcut),
    f(0x23, "Abrir", FuncGroup::Shortcut),
    f(0x24, "Salvar", FuncGroup::Shortcut),
    f(0x25, "Localizar", FuncGroup::Shortcut),
    f(0x27, "Desfazer", FuncGroup::Shortcut),
    f(0x26, "Refazer", FuncGroup::Shortcut),
    f(0x28, "Selecionar tudo", FuncGroup::Shortcut),
    f(0x29, "Imprimir", FuncGroup::Shortcut),
    f(0x2A, "Fechar janela", FuncGroup::Shortcut),
    f(0x2B, "Alternar janelas", FuncGroup::Shortcut),
    f(0x2C, "Mostrar área de trabalho", FuncGroup::Shortcut),
    f(0x2D, "Executar", FuncGroup::Shortcut),
    f(0x2E, "Bloquear o PC", FuncGroup::Shortcut),
    f(0x32, "Captura de tela", FuncGroup::Shortcut),
    f(0x10, "Atalho personalizado", FuncGroup::Special),
    f(0x11, "Macro", FuncGroup::Special),
    f(0x00, "Desativado", FuncGroup::Special),
];

pub fn function_name(id: u8) -> &'static str {
    FUNCTIONS.iter().find(|f| f.id == id).map_or("Função do firmware", |f| f.name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn indices_e_dpi() {
        assert_eq!(index_to_dpi(16), 800);
        assert_eq!(index_to_dpi(200), 10_000);
        assert_eq!(index_to_dpi(201), 10_100);
        assert_eq!(index_to_dpi(350), 25_000);
        for i in 1..=350 {
            assert_eq!(dpi_to_index(index_to_dpi(i)), i);
        }
    }

    #[test]
    fn padrao_ms15() {
        let p = Profile::default();
        assert_eq!(p.buttons.len(), 18);
        assert_eq!(p.buttons[0].func, 1);
        assert_eq!(p.dpi.iter().filter(|s| s.enabled).count(), 6);
    }
}
