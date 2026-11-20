//! Protocolo HID dos mouses compatíveis com o OpenShark (receptor 2.4G `1D57:FA60`).
//! Só dados e codificação: nada aqui fala com o hardware.
//!
//! Visão geral (detalhes em `docs/PROTOCOLO.md`):
//! - configuração por feature reports na coleção HID de usage page 0x0B;
//! - eventos (heartbeat/bateria, troca de DPI, confirmação de envio) no report de entrada 0x03
//!   da coleção de usage page 0x0A;
//! - leitura da configuração atual com o pedido `A0 id len 00 flag`.

pub mod macros;
pub mod models;
pub mod profile;
pub mod report;

pub mod dpi_table {
    //! Tabelas de códigos de DPI e de funções de botão.
    include!("dpi_gen.rs");
}

pub use macros::{Macro, MacroEvent, MacroKind};
pub use models::{DONGLE_PID, MODELS, Model, VID};
pub use profile::{Button, DpiStage, FUNCTIONS, Light, MacroMode, POLLING_HZ, Profile};
pub use report::OsdEvent;
