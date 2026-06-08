use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime};

use super::watcher::start_watcher;

pub struct WindowWatcherState {
    pub active: Mutex<Option<Arc<AtomicBool>>>,
}

impl Default for WindowWatcherState {
    fn default() -> Self {
        Self { active: Mutex::new(None) }
    }
}

#[tauri::command]
pub fn window_watcher_start<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<WindowWatcherState>();
    let mut slot = state.active.lock().map_err(|e| e.to_string())?;
    if slot.is_some() {
        return Ok(()); // already running
    }
    let token = start_watcher(app.clone());
    *slot = Some(token);
    Ok(())
}

#[tauri::command]
pub fn window_watcher_stop(app: AppHandle) -> Result<(), String> {
    let state = app.state::<WindowWatcherState>();
    let mut slot = state.active.lock().map_err(|e| e.to_string())?;
    if let Some(token) = slot.take() {
        token.store(false, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub fn window_watcher_status(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<WindowWatcherState>();
    let slot = state.active.lock().map_err(|e| e.to_string())?;
    Ok(slot.is_some())
}
