//! OpenShark: configurador não oficial para mouses Attack Shark.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apply;
mod commands;
mod startup;
mod state;
mod store;
mod tray_icon;

use std::sync::atomic::Ordering;

use shark_device::{Link, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager as _, WindowEvent};

use crate::state::{AppState, lock};

pub const DISPLAY_NAME: &str = "OpenShark";

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn quit(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.quitting.store(true, Ordering::SeqCst);
    if let Some(m) = state.manager.get() {
        m.stop();
    }
    app.exit(0);
}

fn tray_tooltip(status: &shark_device::Status) -> String {
    match (status.link, status.model, status.battery) {
        (None, ..) => format!("{DISPLAY_NAME} — nenhum mouse"),
        (Some(Link::Wired), Some(n), _) => format!("{DISPLAY_NAME} — MS-{n} no cabo"),
        (Some(Link::Wireless), Some(n), Some(b)) => {
            let b = if status.full { 100 } else { b };
            let extra = if status.charging {
                " (carregando)"
            } else if !status.awake {
                " (dormindo)"
            } else {
                ""
            };
            format!("{DISPLAY_NAME} — MS-{n}, bateria {b}%{extra}")
        }
        (Some(_), ..) => format!("{DISPLAY_NAME} — receptor conectado"),
    }
}

/// Dica e ícone da bandeja conforme o mouse: com bateria conhecida, o mouse com a porcentagem;
/// sem ela, o ícone do programa.
fn update_tray(app: &AppHandle, status: &shark_device::Status) {
    static LAST: std::sync::Mutex<Option<Option<tray_icon::Look>>> = std::sync::Mutex::new(None);
    let Some(tray) = app.tray_by_id("main") else { return };
    let _ = tray.set_tooltip(Some(tray_tooltip(status)));
    let look = tray_icon::Look::from_status(status);
    let mut last = lock(&LAST);
    if *last == Some(look) {
        return;
    }
    *last = Some(look);
    let icon = match look {
        Some(look) => Some(tauri::image::Image::new_owned(tray_icon::render(look), tray_icon::SIZE as u32, tray_icon::SIZE as u32)),
        None => app.default_window_icon().cloned(),
    };
    let _ = tray.set_icon(icon);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let exit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &separator, &exit])?;
    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip(DISPLAY_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "quit" => quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let start_hidden = std::env::args().any(|a| a == startup::MINIMIZED_ARG);

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(move |app| {
            let handle = app.handle().clone();
            if let Err(e) = setup_tray(app) {
                log::warn!("sem ícone na bandeja: {e}");
            }
            let events = handle.clone();
            let manager = Manager::start(move |event| {
                if let shark_device::DeviceEvent::Status { status } = &event {
                    update_tray(&events, status);
                }
                state::on_device_event(&events, event);
            });
            let _ = handle.state::<AppState>().manager.set(manager);
            // O executável pode ter mudado de pasta: a entrada de inicialização acompanha.
            if lock(&handle.state::<AppState>().store).data.settings.autostart {
                let _ = startup::set(true);
            }
            if !start_hidden {
                show_main(&handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                let to_tray = lock(&state.store).data.settings.close_to_tray;
                if to_tray && !state.quitting.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    quit(app);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::save_profile,
            commands::activate_profile,
            commands::create_profile,
            commands::rename_profile,
            commands::delete_profile,
            commands::reset_profile,
            commands::export_profile,
            commands::import_profile,
            commands::read_device,
            commands::save_macro,
            commands::delete_macro,
            commands::set_settings,
            commands::quit,
        ])
        .run(tauri::generate_context!());
    if let Err(e) = result {
        log::error!("{e}");
    }
}
