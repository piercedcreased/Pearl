mod discord;
#[cfg(desktop)]
mod popups;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

/// Start with Windows (Settings > Reminders). Pearl then starts hidden in the tray.
#[cfg(desktop)]
#[tauri::command]
fn autostart_get(app: tauri::AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[cfg(desktop)]
#[tauri::command]
fn autostart_set(app: tauri::AppHandle, on: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let a = app.autolaunch();
    if on { a.enable() } else { a.disable() }.map_err(|e| e.to_string())?;
    Ok(a.is_enabled().unwrap_or(false))
}

/// Really quit (closing the window only hides Pearl to the tray).
#[cfg(desktop)]
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut context = tauri::generate_context!();

    // PEARL_UPDATE_FEED points the updater at another latest.json (testing, or a beta channel later).
    // Updates must still be signed with Pearl's key, so this can't install anything foreign.
    // Plain http is allowed only for a feed on this computer.
    #[cfg(desktop)]
    if let Ok(feed) = std::env::var("PEARL_UPDATE_FEED") {
        if let Some(up) = context.config_mut().plugins.0.get_mut("updater") {
            up["endpoints"] = serde_json::json!([feed]);
            let local = feed.starts_with("http://127.0.0.1") || feed.starts_with("http://localhost");
            if local {
                up["dangerousInsecureTransportProtocol"] = serde_json::json!(true);
            }
        }
    }

    let builder = tauri::Builder::default();

    // Opening Pearl again while it's in the tray brings the running one up instead.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| popups::show_main(app.clone())))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ));

    builder
        .plugin(tauri_plugin_process::init())
        .manage(discord::Discord::default())
        .invoke_handler(tauri::generate_handler![
            discord::discord_set,
            discord::discord_clear,
            discord::discord_ready,
            #[cfg(desktop)]
            popups::popup_open,
            #[cfg(desktop)]
            popups::popup_close,
            #[cfg(desktop)]
            popups::lock_backdrop,
            #[cfg(desktop)]
            popups::lock_hold,
            #[cfg(desktop)]
            popups::pearl_after,
            #[cfg(desktop)]
            popups::show_main,
            #[cfg(desktop)]
            popups::tray_hide,
            #[cfg(desktop)]
            autostart_get,
            #[cfg(desktop)]
            autostart_set,
            #[cfg(desktop)]
            quit
        ])
        .on_window_event(|_w, _e| {
            #[cfg(desktop)]
            match (_w.label(), _e) {
                // closing the main window hides Pearl to the tray, so reminders keep working
                ("main", WindowEvent::CloseRequested { api, .. }) => {
                    api.prevent_close();
                    let _ = _w.hide();
                }
                // Alt+F4 can't close the warning, the lock or the mascot. They only close
                // through the flow (which destroys them), so a reminder can't be skipped.
                (l, WindowEvent::CloseRequested { api, .. })
                    if l.starts_with("lock-") || l.starts_with("warn-") || l.starts_with("pop-") =>
                {
                    api.prevent_close();
                }
                ("tray", WindowEvent::Focused(false)) => popups::tray_lost_focus(_w.app_handle()),
                _ => {}
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

                let open = MenuItem::with_id(app, "open", "Open Pearl", true, None::<&str>)?;
                let test = MenuItem::with_id(app, "test", "Try a reminder now", true, None::<&str>)?;
                let sep = PredefinedMenuItem::separator(app)?;
                let quit = MenuItem::with_id(app, "quit", "Quit Pearl", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open, &test, &sep, &quit])?;
                let mut tray = TrayIconBuilder::with_id("pearl")
                    .tooltip("Pearl")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, e| match e.id.as_ref() {
                        "open" => popups::show_main(app.clone()),
                        "test" => {
                            let _ = app.emit_to("main", "pearl-test", ());
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, e| match e {
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, rect, .. } => {
                            popups::toggle_tray_widget(tray.app_handle(), rect)
                        }
                        TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                            popups::show_main(tray.app_handle().clone())
                        }
                        _ => {}
                    });
                if let Some(icon) = app.default_window_icon() {
                    tray = tray.icon(icon.clone());
                }
                tray.build(app)?;

                // Started with Windows: stay in the tray. Otherwise show the window.
                if let Some(w) = app.get_webview_window("main") {
                    popups::app_like(&w);
                    if !std::env::args().any(|a| a == "--hidden") {
                        let _ = w.show();
                    }
                }
                popups::start_ticks(app.handle().clone());

                // Testing: PEARL_TRAY_TEST=1 opens the tray widget a few seconds after start,
                // as if the tray icon (bottom right) was clicked.
                if std::env::var("PEARL_TRAY_TEST").is_ok() {
                    let h = app.handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(4));
                        let (x, y) = h.primary_monitor().ok().flatten().map(|m| {
                            let (p, z) = (m.position(), m.size());
                            (p.x as f64 + z.width as f64 - 300.0, p.y as f64 + z.height as f64 - 40.0)
                        }).unwrap_or((1600.0, 1000.0));
                        let rect = tauri::Rect {
                            position: tauri::PhysicalPosition::new(x, y).into(),
                            size: tauri::PhysicalSize::new(32.0, 32.0).into(),
                        };
                        let h2 = h.clone();
                        let _ = h.run_on_main_thread(move || popups::toggle_tray_widget(&h2, rect));
                    });
                }
            }
            let _ = app;
            Ok(())
        })
        .run(context)
        .expect("error while running Pearl");
}
