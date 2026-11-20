//! Perfis, macros e preferências, salvos em `%APPDATA%\OpenShark\dados.json`.
//!
//! Cada modelo tem a sua lista e o seu perfil ativo. As macros são uma biblioteca comum.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use shark_proto::{Macro, Model, Profile};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub autostart: bool,
    /// Fechar a janela deixa o app na bandeja (para continuar mostrando a bateria).
    pub close_to_tray: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { autostart: false, close_to_tray: true }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ModelData {
    pub profiles: Vec<Profile>,
    pub active: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Data {
    /// Por número de modelo (`MS_<n>`).
    pub models: BTreeMap<u8, ModelData>,
    pub macros: Vec<Macro>,
    pub settings: Settings,
}

pub struct Store {
    path: PathBuf,
    pub data: Data,
}

pub fn new_id(prefix: &str) -> String {
    static SEQ: AtomicU32 = AtomicU32::new(0);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{prefix}{:x}{:x}", nanos, SEQ.fetch_add(1, Ordering::Relaxed))
}

impl Store {
    pub fn dir() -> PathBuf {
        let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
        let dir = base.join("OpenShark");
        // Pasta de antes de o app se chamar OpenShark: os perfis vêm junto.
        let old = base.join("AttackSharkRS");
        if !dir.exists() && old.exists() {
            let _ = std::fs::rename(&old, &dir);
        }
        dir
    }

    pub fn load() -> Store {
        let path = Store::dir().join("dados.json");
        let data = match std::fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_else(|e| {
                log::warn!("dados.json inválido ({e}); guardando cópia e começando do zero");
                let _ = std::fs::copy(&path, path.with_extension("json.bak"));
                Data::default()
            }),
            Err(_) => Data::default(),
        };
        Store { path, data }
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| format!("criando {}: {e}", dir.display()))?;
        }
        let text = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, text).map_err(|e| format!("gravando {}: {e}", tmp.display()))?;
        std::fs::rename(&tmp, &self.path).map_err(|e| format!("gravando {}: {e}", self.path.display()))
    }

    /// Dados do modelo, criando o "Perfil 1" padrão na primeira vez.
    pub fn model(&mut self, model: &Model) -> &mut ModelData {
        let entry = self.data.models.entry(model.number).or_default();
        if entry.profiles.is_empty() {
            let mut p = Profile::default_for(model);
            p.id = new_id("p");
            p.name = "Perfil 1".into();
            entry.active = p.id.clone();
            entry.profiles.push(p);
        }
        if !entry.profiles.iter().any(|p| p.id == entry.active) {
            entry.active = entry.profiles[0].id.clone();
        }
        for p in &mut entry.profiles {
            p.sanitize(model);
        }
        entry
    }

    pub fn active(&mut self, model: &Model) -> Profile {
        let data = self.model(model);
        data.profiles.iter().find(|p| p.id == data.active).cloned().expect("perfil ativo")
    }

    pub fn put_profile(&mut self, model: &Model, profile: Profile) {
        let data = self.model(model);
        match data.profiles.iter_mut().find(|p| p.id == profile.id) {
            Some(slot) => *slot = profile,
            None => data.profiles.push(profile),
        }
    }

    pub fn macro_by_id(&self, id: &str) -> Option<&Macro> {
        self.data.macros.iter().find(|m| m.id == id)
    }
}
