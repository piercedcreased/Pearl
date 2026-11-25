//! Discord Rich Presence ("Playing Pearl" on your profile).
//!
//! The UI decides exactly what text is shown, and by default that is only "Getting things done".
//! Goal names and progress are sent only when the user picks a goal in Settings > Discord.
//! Nothing runs until the user turns it on.

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use std::sync::Mutex;

/// Pearl's Application ID from https://discord.com/developers/applications (the app's name is
/// what Discord shows after "Playing"). `PEARL_DISCORD_APP_ID` overrides it.
const APP_ID: &str = "1575110259775770755";
const ICON_URL: &str = "https://raw.githubusercontent.com/piercedcreased/Pearl/main/src-tauri/icons/128x128@2x.png";

#[derive(Default)]
pub struct Discord(Mutex<Option<DiscordIpcClient>>);

#[derive(Deserialize)]
pub struct Presence {
    details: String,
    state: Option<String>,
    started: Option<i64>,
}

fn app_id() -> Option<String> {
    std::env::var("PEARL_DISCORD_APP_ID")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| (!APP_ID.is_empty()).then(|| APP_ID.to_string()))
}

/// Discord wants 2 to 128 characters per line.
fn fit(s: &str) -> String {
    let mut t: String = s.chars().take(128).collect();
    while t.chars().count() < 2 {
        t.push(' ');
    }
    t
}

fn set(slot: &mut Option<DiscordIpcClient>, p: &Presence) -> Result<(), String> {
    if slot.is_none() {
        let id = app_id().ok_or("not-set-up")?;
        let mut client = DiscordIpcClient::new(id);
        client.connect().map_err(|_| "discord-closed".to_string())?;
        *slot = Some(client);
    }
    let client = slot.as_mut().unwrap();
    let details = fit(&p.details);
    let state = p.state.as_deref().map(fit);
    let mut act = activity::Activity::new()
        .details(details.as_str())
        .assets(activity::Assets::new().large_image(ICON_URL).large_text("Pearl"));
    if let Some(s) = state.as_deref() {
        act = act.state(s);
    }
    if let Some(t) = p.started {
        act = act.timestamps(activity::Timestamps::new().start(t));
    }
    if client.set_activity(act).is_err() {
        // Discord was closed or restarted. Drop the connection; the next update reconnects.
        let _ = client.close();
        *slot = None;
        return Err("discord-closed".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn discord_set(state: tauri::State<'_, Discord>, presence: Presence) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|_| "busy".to_string())?;
    // The IPC calls are tiny and local, so doing them here is fine.
    set(&mut slot, &presence)
}

#[tauri::command]
pub async fn discord_clear(state: tauri::State<'_, Discord>) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|_| "busy".to_string())?;
    if let Some(mut client) = slot.take() {
        let _ = client.clear_activity();
        let _ = client.close();
    }
    Ok(())
}

#[tauri::command]
pub fn discord_ready() -> bool {
    app_id().is_some()
}
