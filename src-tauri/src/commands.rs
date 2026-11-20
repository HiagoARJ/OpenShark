//! Comandos chamados pela interface (`ui/src/api.ts`).

use serde::{Deserialize, Serialize};
use shark_device::Status;
use shark_proto::profile::FuncInfo;
use shark_proto::{FUNCTIONS, MODELS, Macro, Model, Profile};
use tauri::{AppHandle, Manager as _, State};

use crate::state::{AppState, Outcome, apply_active, lock, sync_from_device};
use crate::store::{Settings, new_id};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub status: Status,
    pub models: &'static [Model],
    pub functions: &'static [FuncInfo],
    /// Perfis do modelo conectado (ou do pedido em `model`).
    pub profiles: Vec<Profile>,
    pub active: String,
    pub macros: Vec<Macro>,
    pub settings: Settings,
    pub pending: bool,
    pub syncing: bool,
}

fn model(number: u8) -> Result<&'static Model, String> {
    Model::by_number(number).ok_or_else(|| format!("modelo {number} desconhecido"))
}

/// Roda fora da thread principal: aplicar pode esperar confirmações do mouse por segundos.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn snapshot(state: State<'_, AppState>, model: Option<u8>) -> Snapshot {
    let status = state.manager().status();
    let number = model.or(status.model);
    let mut store = lock(&state.store);
    let (profiles, active) = match number.and_then(Model::by_number) {
        Some(m) => {
            let data = store.model(m);
            (data.profiles.clone(), data.active.clone())
        }
        None => (Vec::new(), String::new()),
    };
    let link = lock(&state.link);
    Snapshot {
        status,
        models: &MODELS,
        functions: FUNCTIONS,
        profiles,
        active,
        macros: store.data.macros.clone(),
        settings: store.data.settings.clone(),
        pending: link.pending,
        syncing: link.syncing,
    }
}

/// Salva um perfil; se for o ativo, manda as diferenças para o mouse.
#[tauri::command]
pub async fn save_profile(app: AppHandle, model: u8, profile: Profile) -> Result<Outcome, String> {
    let m = self::model(model)?;
    let state = app.state::<AppState>();
    let is_active = {
        let mut store = lock(&state.store);
        let mut profile = profile;
        profile.sanitize(m);
        let active = store.model(m).active == profile.id;
        store.put_profile(m, profile);
        store.save()?;
        active
    };
    if !is_active {
        return Ok(Outcome::Offline);
    }
    let app2 = app.clone();
    blocking(move || apply_active(&app2, model, false)).await
}

#[tauri::command]
pub async fn activate_profile(app: AppHandle, model: u8, id: String) -> Result<Outcome, String> {
    let m = self::model(model)?;
    {
        let state = app.state::<AppState>();
        let mut store = lock(&state.store);
        let data = store.model(m);
        if !data.profiles.iter().any(|p| p.id == id) {
            return Err("perfil não encontrado".into());
        }
        data.active = id;
        store.save()?;
    }
    let app2 = app.clone();
    blocking(move || apply_active(&app2, model, true)).await
}

#[tauri::command]
pub fn create_profile(state: State<'_, AppState>, model: u8, name: String, copy_of: Option<String>) -> Result<String, String> {
    let m = self::model(model)?;
    let mut store = lock(&state.store);
    let data = store.model(m);
    let mut p = copy_of
        .and_then(|id| data.profiles.iter().find(|p| p.id == id).cloned())
        .unwrap_or_else(|| Profile::default_for(m));
    p.id = new_id("p");
    p.name = unique_name(&data.profiles, name.trim());
    let id = p.id.clone();
    data.profiles.push(p);
    store.save()?;
    Ok(id)
}

fn unique_name(profiles: &[Profile], wanted: &str) -> String {
    let base = if wanted.is_empty() { "Perfil" } else { wanted };
    if !profiles.iter().any(|p| p.name == base) {
        return base.to_owned();
    }
    (2..).map(|n| format!("{base} {n}")).find(|n| !profiles.iter().any(|p| &p.name == n)).unwrap()
}

#[tauri::command]
pub fn rename_profile(state: State<'_, AppState>, model: u8, id: String, name: String) -> Result<(), String> {
    let m = self::model(model)?;
    let name = name.trim().to_owned();
    if name.is_empty() {
        return Err("o nome não pode ficar vazio".into());
    }
    let mut store = lock(&state.store);
    let data = store.model(m);
    if data.profiles.iter().any(|p| p.name == name && p.id != id) {
        return Err("já existe um perfil com esse nome".into());
    }
    if let Some(p) = data.profiles.iter_mut().find(|p| p.id == id) {
        p.name = name;
    }
    store.save()
}

#[tauri::command]
pub async fn delete_profile(app: AppHandle, model: u8, id: String) -> Result<Outcome, String> {
    let m = self::model(model)?;
    let was_active = {
        let state = app.state::<AppState>();
        let mut store = lock(&state.store);
        let data = store.model(m);
        if data.profiles.len() <= 1 {
            return Err("mantenha pelo menos um perfil".into());
        }
        data.profiles.retain(|p| p.id != id);
        let was_active = data.active == id;
        if was_active {
            data.active = data.profiles[0].id.clone();
        }
        store.save()?;
        was_active
    };
    if !was_active {
        return Ok(Outcome::Offline);
    }
    let app2 = app.clone();
    blocking(move || apply_active(&app2, model, true)).await
}

/// "Restaurar padrão": os valores de fábrica, mantendo nome e id.
#[tauri::command]
pub async fn reset_profile(app: AppHandle, model: u8, id: String) -> Result<Outcome, String> {
    let m = self::model(model)?;
    let is_active = {
        let state = app.state::<AppState>();
        let mut store = lock(&state.store);
        let data = store.model(m);
        let Some(p) = data.profiles.iter_mut().find(|p| p.id == id) else {
            return Err("perfil não encontrado".into());
        };
        let mut fresh = Profile::default_for(m);
        fresh.id = p.id.clone();
        fresh.name = p.name.clone();
        *p = fresh;
        let active = data.active == id;
        store.save()?;
        active
    };
    if !is_active {
        return Ok(Outcome::Offline);
    }
    let app2 = app.clone();
    blocking(move || apply_active(&app2, model, true)).await
}

/// Arquivo de perfil exportado: o perfil e as macros que os botões dele usam.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileFile {
    format: String,
    model: u8,
    profile: Profile,
    #[serde(default)]
    macros: Vec<Macro>,
}

const PROFILE_FORMAT: &str = "openshark/perfil/1";
/// Formato dos arquivos exportados antes de o app se chamar OpenShark.
const OLD_PROFILE_FORMAT: &str = "attack-shark-rs/perfil/1";

#[tauri::command]
pub fn export_profile(state: State<'_, AppState>, model: u8, id: String, path: String) -> Result<(), String> {
    let m = self::model(model)?;
    let mut store = lock(&state.store);
    let profile = store.model(m).profiles.iter().find(|p| p.id == id).cloned().ok_or("perfil não encontrado")?;
    let macros = profile
        .buttons
        .iter()
        .filter_map(|b| b.macro_id.as_deref())
        .filter_map(|id| store.macro_by_id(id).cloned())
        .collect();
    let file = ProfileFile { format: PROFILE_FORMAT.into(), model, profile, macros };
    let text = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| format!("gravando {path}: {e}"))
}

#[tauri::command]
pub fn import_profile(state: State<'_, AppState>, model: u8, path: String) -> Result<String, String> {
    let m = self::model(model)?;
    let text = std::fs::read_to_string(&path).map_err(|e| format!("lendo {path}: {e}"))?;
    let file: ProfileFile = serde_json::from_str(&text).map_err(|_| "arquivo de perfil inválido".to_owned())?;
    if file.format != PROFILE_FORMAT && file.format != OLD_PROFILE_FORMAT {
        return Err("arquivo de perfil de outro formato".into());
    }
    let mut store = lock(&state.store);
    for mac in file.macros {
        if store.macro_by_id(&mac.id).is_none() {
            store.data.macros.push(mac);
        }
    }
    let data = store.model(m);
    let mut p = file.profile;
    p.id = new_id("p");
    p.name = unique_name(&data.profiles, &p.name);
    p.sanitize(m);
    let id = p.id.clone();
    data.profiles.push(p);
    store.save()?;
    Ok(id)
}

/// Lê de novo a configuração do mouse para o perfil ativo.
#[tauri::command]
pub async fn read_device(app: AppHandle, model: u8) -> Result<(), String> {
    let app2 = app.clone();
    blocking(move || sync_from_device(&app2, model)).await?
}

#[tauri::command]
pub async fn save_macro(app: AppHandle, value: Macro) -> Result<(String, Option<Outcome>), String> {
    let state = app.state::<AppState>();
    let mut value = value;
    if value.id.is_empty() {
        value.id = new_id("m");
    }
    let id = value.id.clone();
    let used_by_active = {
        let mut store = lock(&state.store);
        match store.data.macros.iter_mut().find(|m| m.id == id) {
            Some(slot) => *slot = value,
            None => store.data.macros.push(value),
        }
        store.save()?;
        let status = state.manager().status();
        match status.model.and_then(Model::by_number) {
            Some(m) => store.active(m).buttons.iter().any(|b| b.func == 0x11 && b.macro_id.as_deref() == Some(id.as_str())).then_some(m.number),
            None => None,
        }
    };
    let outcome = match used_by_active {
        Some(number) => {
            let app2 = app.clone();
            Some(blocking(move || apply_active(&app2, number, false)).await?)
        }
        None => None,
    };
    Ok((id, outcome))
}

#[tauri::command]
pub fn delete_macro(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut store = lock(&state.store);
    store.data.macros.retain(|m| m.id != id);
    // Botões que usavam a macro voltam à função padrão do modelo.
    for (number, data) in store.data.models.iter_mut() {
        let defaults = Model::by_number(*number).map(|m| m.default_buttons).unwrap_or([0; 18]);
        for p in &mut data.profiles {
            for (i, b) in p.buttons.iter_mut().enumerate() {
                if b.macro_id.as_deref() == Some(id.as_str()) {
                    b.macro_id = None;
                    if b.func == 0x11 {
                        b.func = defaults[i];
                    }
                }
            }
        }
    }
    store.save()
}

#[tauri::command]
pub fn set_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    crate::startup::set(settings.autostart)?;
    let mut store = lock(&state.store);
    store.data.settings = settings;
    store.save()
}

#[tauri::command]
pub fn quit(app: AppHandle) {
    crate::quit(&app);
}
