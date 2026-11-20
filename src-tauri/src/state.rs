//! Estado do app e a orquestração com o mouse: sincronizar ao conectar (ler o que o
//! mouse tem), aplicar mudanças e guardar o que ficou pendente enquanto o mouse dormia.

use std::sync::atomic::AtomicBool;
use std::sync::{Mutex, MutexGuard, OnceLock};

use serde::Serialize;
use shark_device::{DeviceEvent, Link, Manager, Status};
use shark_proto::{Model, OsdEvent};
use tauri::{AppHandle, Emitter, Manager as _};

use crate::apply::{Sent, apply};
use crate::store::Store;

pub fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

/// O que vale só enquanto o mesmo mouse está conectado.
#[derive(Default)]
pub struct LinkState {
    pub model: Option<u8>,
    pub sent: Sent,
    pub synced: bool,
    pub syncing: bool,
    pub sync_attempts: u8,
    /// Há mudanças salvas que o mouse ainda não recebeu (estava dormindo).
    pub pending: bool,
}

pub struct AppState {
    pub store: Mutex<Store>,
    pub link: Mutex<LinkState>,
    pub apply_lock: Mutex<()>,
    pub manager: OnceLock<Manager>,
    pub quitting: AtomicBool,
}

impl AppState {
    pub fn new() -> AppState {
        AppState {
            store: Mutex::new(Store::load()),
            link: Mutex::new(LinkState::default()),
            apply_lock: Mutex::new(()),
            manager: OnceLock::new(),
            quitting: AtomicBool::new(false),
        }
    }

    pub fn manager(&self) -> &Manager {
        self.manager.get().expect("gerenciador iniciado no setup")
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Outcome {
    /// O mouse recebeu.
    Applied,
    /// Salvo; vai para o mouse quando ele acordar.
    Pending,
    /// Salvo; nenhum mouse deste modelo conectado.
    Offline,
    Error(String),
}

/// Aplica o perfil ativo do modelo. `full` manda tudo (troca de perfil, restaurar padrão).
pub fn apply_active(app: &AppHandle, number: u8, full: bool) -> Outcome {
    let state = app.state::<AppState>();
    let manager = state.manager();
    let Some(model) = Model::by_number(number) else { return Outcome::Error("modelo desconhecido".into()) };
    let status = manager.status();
    if status.model != Some(number) || status.link.is_none() {
        return Outcome::Offline;
    }
    if !model.supported {
        return Outcome::Error("este modelo ainda não é suportado para gravação".into());
    }
    if status.link == Some(Link::Wireless) && !status.awake {
        lock(&state.link).pending = true;
        return Outcome::Pending;
    }
    let _guard = lock(&state.apply_lock);
    let (profile, macros) = {
        let mut store = lock(&state.store);
        (store.active(model), store.data.macros.clone())
    };
    let mut sent = std::mem::take(&mut lock(&state.link).sent);
    if full {
        sent.profile = None;
    }
    let result = apply(manager, model, &profile, &macros, &mut sent);
    let mut link = lock(&state.link);
    link.sent = sent;
    match result {
        Ok(()) => {
            link.pending = false;
            Outcome::Applied
        }
        Err(e) => {
            link.pending = true;
            log::warn!("aplicando perfil: {e}");
            Outcome::Error(e.to_string())
        }
    }
}

/// Lê DPI, energia e polling do mouse e grava no perfil ativo.
pub fn sync_from_device(app: &AppHandle, number: u8) -> Result<(), String> {
    let state = app.state::<AppState>();
    let model = Model::by_number(number).ok_or("modelo desconhecido")?;
    let _guard = lock(&state.apply_lock);
    let result = state.manager().read_config();
    let mut store = lock(&state.store);
    let mut profile = store.active(model);
    let outcome = match result {
        Ok(cfg) => {
            if let Some((stages, active, angle, ripple)) = cfg.dpi {
                profile.dpi = stages;
                profile.active_stage = active;
                profile.angle_snap = angle;
                profile.ripple = ripple;
            }
            if let Some((light, sleep, deep, debounce)) = cfg.power {
                profile.light = light;
                profile.sleep_minutes = sleep;
                profile.deep_sleep = deep;
                profile.debounce = debounce;
            }
            if let Some(polling) = cfg.polling {
                profile.polling = polling;
            }
            profile.sanitize(model);
            store.put_profile(model, profile.clone());
            let _ = store.save();
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    };
    drop(store);
    // Daqui em diante as mudanças vão por diferença em relação ao que o mouse tem (os botões
    // não têm leitura: vale o que está salvo).
    let mut link = lock(&state.link);
    if link.model == Some(number) {
        link.sent.profile = Some(profile);
    }
    drop(link);
    let _ = app.emit("profile://changed", number);
    outcome
}

fn spawn_sync(app: &AppHandle, number: u8) {
    let app = app.clone();
    std::thread::spawn(move || {
        let result = sync_from_device(&app, number);
        let state = app.state::<AppState>();
        let pending = {
            let mut link = lock(&state.link);
            link.syncing = false;
            link.sync_attempts += 1;
            link.synced = result.is_ok() || link.sync_attempts >= 3;
            link.pending
        };
        if let Err(e) = result {
            log::info!("sincronização: {e}");
        }
        if pending {
            let outcome = apply_active(&app, number, false);
            let _ = app.emit("apply://result", outcome);
        }
    });
}

pub fn on_device_event(app: &AppHandle, event: DeviceEvent) {
    match &event {
        DeviceEvent::Status { status } => {
            let _ = app.emit("device://status", status);
            on_status(app, status);
        }
        DeviceEvent::Osd { event } => {
            let _ = app.emit("device://osd", event);
            if let OsdEvent::DpiStage { stage, .. } = *event {
                on_dpi_stage(app, stage);
            }
        }
    }
}

fn on_status(app: &AppHandle, status: &Status) {
    let state = app.state::<AppState>();
    let mut link = lock(&state.link);
    if status.link.is_none() || link.model != status.model {
        *link = LinkState { model: status.model, ..LinkState::default() };
    }
    let Some(number) = status.model else { return };
    let usable = status.awake || status.link == Some(Link::Wired);
    let supported = Model::by_number(number).is_some_and(|m| m.supported);
    if !usable || !supported {
        return;
    }
    if !link.synced && !link.syncing {
        link.syncing = true;
        drop(link);
        spawn_sync(app, number);
    } else if link.pending && link.synced && !link.syncing {
        link.pending = false;
        drop(link);
        let app = app.clone();
        std::thread::spawn(move || {
            let outcome = apply_active(&app, number, false);
            let _ = app.emit("apply://result", outcome);
        });
    }
}

/// O botão de DPI do mouse trocou o estágio: o perfil ativo acompanha.
fn on_dpi_stage(app: &AppHandle, stage: u8) {
    let state = app.state::<AppState>();
    let Some(number) = state.manager().status().model else { return };
    let Some(model) = Model::by_number(number) else { return };
    let index = stage.saturating_sub(1);
    if index >= model.dpi_stages {
        return;
    }
    {
        let mut store = lock(&state.store);
        let mut profile = store.active(model);
        if profile.active_stage == index {
            return;
        }
        profile.active_stage = index;
        store.put_profile(model, profile);
        let _ = store.save();
    }
    if let Some(sent) = lock(&state.link).sent.profile.as_mut() {
        sent.active_stage = index;
    }
    let _ = app.emit("profile://changed", number);
}
