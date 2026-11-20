//! Manda um perfil para o mouse: só os grupos que mudaram em relação
//! ao que o mouse já tem; sem referência (troca de perfil, restaurar padrão), o pacote 0x0C e tudo.

use std::collections::HashMap;

use shark_device::{Error, Manager};
use shark_proto::macros::macro_packets;
use shark_proto::report;
use shark_proto::{Macro, Model, Profile};

/// Máximo de slots consecutivos por macro (os primeiros slots dos botões vêm de 4 em 4).
const MACRO_SLOTS: u8 = 4;

fn dpi_group(p: &Profile) -> impl PartialEq + '_ {
    (&p.dpi, p.active_stage, p.angle_snap, p.ripple)
}

fn power_group(p: &Profile) -> impl PartialEq + '_ {
    (&p.light, p.sleep_minutes, p.deep_sleep, p.debounce)
}

/// Pacotes de macro de cada slot inicial, para os botões com função "Macro".
fn macro_plan(p: &Profile, model: &Model, macros: &[Macro]) -> HashMap<u8, Vec<[u8; 0x83]>> {
    let mut plan = HashMap::new();
    for (i, b) in p.buttons.iter().enumerate() {
        let slot = model.macro_slot(i);
        if b.func != 0x11 || slot == 0 {
            continue;
        }
        let Some(m) = b.macro_id.as_deref().and_then(|id| macros.iter().find(|m| m.id == id)) else {
            continue;
        };
        plan.insert(slot, macro_packets(m, slot, b.macro_mode, b.macro_repeat, MACRO_SLOTS));
    }
    plan
}

/// O que já foi mandado para o mouse nesta conexão.
#[derive(Default)]
pub struct Sent {
    pub profile: Option<Profile>,
    pub macros: HashMap<u8, Vec<[u8; 0x83]>>,
}

pub fn apply(
    manager: &Manager,
    model: &Model,
    profile: &Profile,
    macros: &[Macro],
    sent: &mut Sent,
) -> Result<(), Error> {
    let full = sent.profile.is_none();
    let old = sent.profile.clone();
    let changed = |f: &dyn Fn(&Profile) -> bool| old.as_ref().is_none_or(f);

    if full {
        manager.send(&report::sync_packet())?;
        sent.macros.clear();
    }
    if changed(&|o| dpi_group(o) != dpi_group(profile)) {
        manager.send(&report::dpi_packet(profile))?;
    }
    if changed(&|o| power_group(o) != power_group(profile)) {
        manager.send(&report::power_packet(profile))?;
    }
    if changed(&|o| o.polling != profile.polling) {
        manager.send(&report::polling_packet(profile))?;
    }
    if changed(&|o| o.buttons != profile.buttons) {
        manager.send(&report::buttons_packet(profile, model))?;
    }
    for (slot, packets) in macro_plan(profile, model, macros) {
        if sent.macros.get(&slot) == Some(&packets) {
            continue;
        }
        for p in &packets {
            manager.send_macro(p)?;
        }
        sent.macros.insert(slot, packets);
    }
    sent.profile = Some(profile.clone());
    Ok(())
}
