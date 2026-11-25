mod discord;

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

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .manage(discord::Discord::default())
        .invoke_handler(tauri::generate_handler![
            discord::discord_set,
            discord::discord_clear,
            discord::discord_ready
        ])
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let _ = app;
            Ok(())
        })
        .run(context)
        .expect("error while running Pearl");
}
