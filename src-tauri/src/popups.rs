//! Pearl's desktop pop-ups: the 15 s warning, the lock screen, the mascot in the corner,
//! and the tray widget. Each one is a small always-on-top window that loads the same UI with
//! `?screen=<kind>&win=1`.
//!
//! The reminder flow itself (what shows when, the mascot's moods, snooze punishment) lives in
//! `ui/flow.js` in the main window. Rust only opens and closes windows, keeps time, and holds
//! the lock screen in front during a lockdown.

use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Rect, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

/// Make a window feel like an app instead of a web page: no Edge right-click menu, no browser
/// keys (F5, Ctrl+R, Ctrl+F, Ctrl+P, F12, Alt+Left...), no swipe back, no autofill bubbles.
/// Typing, copy and paste still work.
pub fn app_like(w: &WebviewWindow) {
    #[cfg(windows)]
    let _ = w.with_webview(|pw| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::*;
        use windows_core::Interface;
        let Ok(core) = pw.controller().CoreWebView2() else { return };
        let Ok(s) = core.Settings() else { return };
        let _ = s.SetAreDefaultContextMenusEnabled(false);
        let _ = s.SetIsStatusBarEnabled(false);
        if let Ok(s3) = s.cast::<ICoreWebView2Settings3>() {
            let _ = s3.SetAreBrowserAcceleratorKeysEnabled(false);
        }
        if let Ok(s4) = s.cast::<ICoreWebView2Settings4>() {
            let _ = s4.SetIsGeneralAutofillEnabled(false);
            let _ = s4.SetIsPasswordAutosaveEnabled(false);
        }
        if let Ok(s6) = s.cast::<ICoreWebView2Settings6>() {
            let _ = s6.SetIsSwipeNavigationEnabled(false);
        }
    });
    #[cfg(not(windows))]
    let _ = w;
}

static SEQ: AtomicU32 = AtomicU32::new(0);
/// True while a lockdown is running: the lock window can't be closed and keeps grabbing focus.
pub static HOLD: AtomicBool = AtomicBool::new(false);
/// The blurred picture behind the lock screen: width, height, RGBA pixels.
static BACKDROP: Mutex<Option<(u32, u32, Vec<u8>)>> = Mutex::new(None);
/// When the tray widget last hid itself (ms), so the click that hid it doesn't reopen it.
static TRAY_HIDDEN_AT: AtomicU64 = AtomicU64::new(0);
/// When it last opened: a focus change right as it opens shouldn't close it again.
static TRAY_SHOWN_AT: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// The primary monitor's full rect and work area (without the taskbar), in logical pixels.
fn screen(app: &AppHandle) -> Option<((f64, f64, f64, f64), (f64, f64, f64, f64))> {
    let m = app.primary_monitor().ok().flatten()?;
    let s = m.scale_factor();
    let (p, z) = (m.position(), m.size());
    let w = m.work_area();
    Some((
        (p.x as f64 / s, p.y as f64 / s, z.width as f64 / s, z.height as f64 / s),
        (w.position.x as f64 / s, w.position.y as f64 / s, w.size.width as f64 / s, w.size.height as f64 / s),
    ))
}

fn popups_of(app: &AppHandle, kind: &str) -> Vec<WebviewWindow> {
    let prefix = format!("{kind}-");
    app.webview_windows().into_iter().filter(|(l, _)| l.starts_with(&prefix)).map(|(_, w)| w).collect()
}

/// Open a pop-up. `kind` is warn, lock or pop; `query` is extra URL parameters for the page.
/// Any older pop-up of the same kind is closed first. (async: building a window from a sync
/// command deadlocks on Windows)
#[tauri::command]
pub async fn popup_open(app: AppHandle, kind: String, query: String) -> Result<(), String> {
    if !matches!(kind.as_str(), "warn" | "lock" | "pop") {
        return Err(format!("unknown pop-up {kind}"));
    }
    let old = popups_of(&app, &kind);
    let ((sx, sy, sw, sh), (wx, wy, ww, wh)) = screen(&app).ok_or("no monitor")?;
    let (x, y, w, h, focus) = match kind.as_str() {
        // bottom middle, above the taskbar, without taking focus from a game
        "warn" => (wx + (ww - 600.0) / 2.0, wy + wh - 150.0, 600.0, 130.0, false),
        // the whole screen, taskbar included
        "lock" => (sx, sy, sw, sh, true),
        // bottom-left corner of the work area, so the mascot climbs out from behind the taskbar
        _ => (wx, wy + wh - 480.0, 680.0, 480.0, false),
    };
    let label = format!("{kind}-{}", SEQ.fetch_add(1, Ordering::Relaxed));
    let url = format!("index.html?screen={kind}&win=1&{query}");
    let b = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("Pearl")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(focus)
        .position(x, y)
        .inner_size(w, h);
    if kind == "lock" {
        // The lock page blurs a tiny snapshot of the screen taken right now. (Windows' own
        // Blur/Acrylic window effects showed up as flat grey in testing.)
        if let Some(m) = app.primary_monitor().ok().flatten() {
            let (p, z) = (m.position(), m.size());
            *BACKDROP.lock().unwrap() = snapshot(p.x, p.y, z.width as i32, z.height as i32);
        }
        keyguard::on();
    }
    let win = b.build().map_err(|e| e.to_string())?;
    app_like(&win);
    for w in old {
        let _ = w.destroy();
    }
    Ok(())
}

/// The lock page asks for the snapshot: 8 bytes of width and height, then RGBA pixels.
#[tauri::command]
pub fn lock_backdrop() -> tauri::ipc::Response {
    let mut out = Vec::new();
    if let Some((w, h, px)) = BACKDROP.lock().unwrap().as_ref() {
        out.extend_from_slice(&w.to_le_bytes());
        out.extend_from_slice(&h.to_le_bytes());
        out.extend_from_slice(px);
    }
    tauri::ipc::Response::new(out)
}

/// A screen snapshot at 1/6 size (it gets blurred anyway, so it stays tiny and fast).
#[cfg(windows)]
fn snapshot(x: i32, y: i32, w: i32, h: i32) -> Option<(u32, u32, Vec<u8>)> {
    use windows_sys::Win32::Graphics::Gdi::*;
    let (tw, th) = ((w / 6).max(1), (h / 6).max(1));
    unsafe {
        let screen = GetDC(std::ptr::null_mut());
        if screen.is_null() {
            return None;
        }
        let mem = CreateCompatibleDC(screen);
        let bmp = CreateCompatibleBitmap(screen, tw, th);
        let old = SelectObject(mem, bmp as _);
        SetStretchBltMode(mem, HALFTONE);
        StretchBlt(mem, 0, 0, tw, th, screen, x, y, w, h, SRCCOPY);
        SelectObject(mem, old);
        let mut info: BITMAPINFO = std::mem::zeroed();
        info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        info.bmiHeader.biWidth = tw;
        info.bmiHeader.biHeight = -th; // top-down rows
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;
        let mut px = vec![0u8; (tw * th * 4) as usize];
        let rows = GetDIBits(mem, bmp, 0, th as u32, px.as_mut_ptr() as _, &mut info, DIB_RGB_COLORS);
        DeleteObject(bmp as _);
        DeleteDC(mem);
        ReleaseDC(std::ptr::null_mut(), screen);
        if rows == 0 {
            return None;
        }
        for c in px.chunks_exact_mut(4) {
            c.swap(0, 2); // BGRA -> RGBA
            c[3] = 255;
        }
        Some((tw as u32, th as u32, px))
    }
}

#[cfg(not(windows))]
fn snapshot(_x: i32, _y: i32, _w: i32, _h: i32) -> Option<(u32, u32, Vec<u8>)> {
    None
}

#[tauri::command]
pub fn popup_close(app: AppHandle, kind: String) {
    if kind == "lock" {
        HOLD.store(false, Ordering::SeqCst);
        keyguard::off();
    }
    for w in popups_of(&app, &kind) {
        let _ = w.destroy();
    }
}

/// Lockdown: for `secs` seconds the lock window can't be closed and keeps itself in front.
/// Ctrl+Alt+Del still works (Windows doesn't let any app block it).
#[tauri::command]
pub fn lock_hold(app: AppHandle, secs: u64) {
    HOLD.store(true, Ordering::SeqCst);
    std::thread::spawn(move || {
        let end = now_ms() + secs.min(180) * 1000;
        while HOLD.load(Ordering::SeqCst) && now_ms() < end {
            for w in popups_of(&app, "lock") {
                let _ = w.set_always_on_top(true);
                if !w.is_focused().unwrap_or(true) {
                    let _ = w.set_focus();
                }
            }
            std::thread::sleep(Duration::from_millis(400));
        }
        HOLD.store(false, Ordering::SeqCst);
    });
}

/// A timer that isn't slowed down while the main window is hidden: after `ms`, the main
/// window gets a `pearl-timer` event carrying `tag`.
#[tauri::command]
pub fn pearl_after(app: AppHandle, ms: u64, tag: String) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(ms));
        let _ = app.emit_to("main", "pearl-timer", tag);
    });
}

/// Every 15 s the main window gets `pearl-tick`, to check what's due.
pub fn start_ticks(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(15));
        let _ = app.emit_to("main", "pearl-tick", ());
    });
}

#[tauri::command]
pub fn show_main(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    hide_tray_widget(&app);
}

#[tauri::command]
pub fn tray_hide(app: AppHandle) {
    hide_tray_widget(&app);
}

/// Clicking anywhere else closes the widget (but not in the first moment after it opens).
pub fn tray_lost_focus(app: &AppHandle) {
    if now_ms().saturating_sub(TRAY_SHOWN_AT.load(Ordering::SeqCst)) > 700 {
        hide_tray_widget(app);
    }
}

pub fn hide_tray_widget(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("tray") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
            TRAY_HIDDEN_AT.store(now_ms(), Ordering::SeqCst);
        }
    }
}

/// Left click on the tray icon: a little Pearl window pops up right above it (like Mullvad's).
pub fn toggle_tray_widget(app: &AppHandle, rect: Rect) {
    const W: f64 = 340.0;
    const H: f64 = 372.0;
    let w = match app.get_webview_window("tray") {
        Some(w) => {
            if w.is_visible().unwrap_or(false) {
                hide_tray_widget(app);
                return;
            }
            // the click that just closed it (by taking focus away) shouldn't reopen it
            if now_ms().saturating_sub(TRAY_HIDDEN_AT.load(Ordering::SeqCst)) < 350 {
                return;
            }
            w
        }
        None => match WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("index.html?screen=tray&win=1".into()))
            .title("Pearl")
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false)
            .inner_size(W, H)
            .build()
        {
            Ok(w) => {
                app_like(&w);
                w
            }
            Err(_) => return,
        },
    };
    let scale = w.scale_factor().unwrap_or(1.0);
    let p = rect.position.to_physical::<f64>(scale);
    let s = rect.size.to_physical::<f64>(scale);
    let (pw, ph) = (W * scale, H * scale);
    let mut x = p.x + s.width / 2.0 - pw / 2.0;
    let mut y = p.y - ph - 8.0 * scale;
    if let Some(m) = app.primary_monitor().ok().flatten() {
        let wa = m.work_area();
        let (ax, ay) = (wa.position.x as f64, wa.position.y as f64);
        let (aw, ah) = (wa.size.width as f64, wa.size.height as f64);
        if y < ay {
            y = p.y + s.height + 8.0 * scale; // taskbar on top
        }
        x = x.clamp(ax + 8.0, ax + aw - pw - 8.0);
        y = y.clamp(ay + 8.0, ay + ah - ph - 8.0);
    }
    let _ = w.set_position(PhysicalPosition::new(x, y));
    let _ = w.set_size(LogicalSize::new(W, H));
    TRAY_SHOWN_AT.store(now_ms(), Ordering::SeqCst);
    let _ = w.show();
    let _ = w.set_focus();
    let _ = w.emit_to("tray", "pearl-tray-open", ());
}

/// While a lock screen is up, the Windows key, Alt+Tab, Alt+Esc, Alt+F4, Alt+Space and
/// Ctrl+Esc / Ctrl+Shift+Esc do nothing, so the lock can't just be stepped around.
/// A low-level keyboard hook on its own thread, only installed while a lock is open (so it
/// never slows typing or games otherwise). Ctrl+Alt+Del can't be blocked by any app, and the
/// readme says so.
#[cfg(windows)]
mod keyguard {
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering::SeqCst};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::GetCurrentThreadId;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    static WANT: AtomicBool = AtomicBool::new(false);
    static RUNNING: AtomicBool = AtomicBool::new(false);
    static THREAD: AtomicU32 = AtomicU32::new(0);

    unsafe extern "system" fn hook(code: i32, w: usize, l: isize) -> isize {
        unsafe {
            if code == HC_ACTION as i32 {
                let k = &*(l as *const KBDLLHOOKSTRUCT);
                let vk = k.vkCode as u16;
                let alt = k.flags & LLKHF_ALTDOWN != 0;
                let ctrl = GetAsyncKeyState(VK_CONTROL as i32) < 0;
                let block = vk == VK_LWIN
                    || vk == VK_RWIN
                    || (alt && matches!(vk, VK_TAB | VK_ESCAPE | VK_F4 | VK_SPACE))
                    || (ctrl && vk == VK_ESCAPE);
                if block {
                    return 1;
                }
            }
            CallNextHookEx(std::ptr::null_mut(), code, w, l)
        }
    }

    pub fn on() {
        WANT.store(true, SeqCst);
        if RUNNING.swap(true, SeqCst) {
            return;
        }
        std::thread::spawn(|| unsafe {
            let h = SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook), GetModuleHandleW(std::ptr::null()), 0);
            THREAD.store(GetCurrentThreadId(), SeqCst);
            let mut msg: MSG = std::mem::zeroed();
            // the hook only works while this thread keeps pumping messages
            while WANT.load(SeqCst) && GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}
            if !h.is_null() {
                UnhookWindowsHookEx(h);
            }
            THREAD.store(0, SeqCst);
            RUNNING.store(false, SeqCst);
        });
    }

    pub fn off() {
        WANT.store(false, SeqCst);
        let t = THREAD.load(SeqCst);
        if t != 0 {
            unsafe { PostThreadMessageW(t, WM_QUIT, 0, 0) };
        }
    }
}

#[cfg(not(windows))]
mod keyguard {
    pub fn on() {}
    pub fn off() {}
}
