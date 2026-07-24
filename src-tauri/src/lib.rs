use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[tauri::command]
fn toggle_play(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("media:play_pause", ());
    }
}

#[tauri::command]
fn next_channel(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("media:next", ());
    }
}

#[tauri::command]
fn prev_channel(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("media:prev", ());
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let play_pause = MenuItemBuilder::with_id("play_pause", "Reproducir/Pausar").build(app)?;
    let next = MenuItemBuilder::with_id("next", "Siguiente canal").build(app)?;
    let prev = MenuItemBuilder::with_id("prev", "Anterior canal").build(app)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let show = MenuItemBuilder::with_id("show", "Mostrar ventana").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Salir").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&play_pause, &next, &prev, &separator, &show, &quit])
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Flux IPTV")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "play_pause" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("media:play_pause", ());
                    }
                }
                "next" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("media:next", ());
                    }
                }
                "prev" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("media:prev", ());
                    }
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn setup_global_shortcuts(app: &tauri::App) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let shortcuts = app.global_shortcut();
    let handle = app.handle().clone();
    shortcuts.on_shortcut(move |_app, event, _shortcut| {
        let id = event.id();
        if id == "play_pause" {
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.emit("media:play_pause", ());
            }
        } else if id == "next_channel" {
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.emit("media:next", ());
            }
        } else if id == "prev_channel" {
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.emit("media:prev", ());
            }
        }
    });
    let _ = shortcuts.register("MediaPlayPause", |_app, _shortcut| {});
    let _ = shortcuts.register("MediaNextTrack", |_app, _shortcut| {});
    let _ = shortcuts.register("MediaPrevTrack", |_app, _shortcut| {});
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            setup_tray(app)?;
            setup_global_shortcuts(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![toggle_play, next_channel, prev_channel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
