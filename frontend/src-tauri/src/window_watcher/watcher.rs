use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::time::sleep;

/// Polls the foreground window title every 2s. When it matches a known
/// meeting URL/app pattern AND it's a fresh transition (not the same meeting
/// title we already saw), emits `active-meeting-detected` with payload.
///
/// Frontend listener then triggers the existing meetingPrompt flow.

#[derive(Debug, Clone, Serialize)]
pub struct DetectedMeeting {
    pub source: String,    // "google-meet" | "zoom" | "teams" | "webex"
    pub title: String,     // raw window title
    pub url_hint: String,  // best-effort URL extracted from title
}

const POLL_MS: u64 = 2000;

pub fn detect_meeting(title: &str) -> Option<DetectedMeeting> {
    let t = title.to_lowercase();

    // Google Meet — Chrome puts "Meet - <name> - Google Chrome" in title
    if t.contains("meet.google.com") || t.starts_with("meet - ") || t.contains(" - meet - ") {
        return Some(DetectedMeeting {
            source: "google-meet".to_string(),
            title: title.to_string(),
            url_hint: "https://meet.google.com".to_string(),
        });
    }

    // Zoom — desktop client window title pattern "Zoom Meeting" or "<name>'s Personal Meeting Room"
    if t.starts_with("zoom meeting") || t.contains("zoom meeting") || t.contains("zoom workplace") {
        return Some(DetectedMeeting {
            source: "zoom".to_string(),
            title: title.to_string(),
            url_hint: "zoom://".to_string(),
        });
    }

    // Microsoft Teams — "Microsoft Teams" + "Meeting" or "Call"
    if (t.contains("microsoft teams") || t.contains(" | teams"))
        && (t.contains("meeting") || t.contains("call"))
    {
        return Some(DetectedMeeting {
            source: "teams".to_string(),
            title: title.to_string(),
            url_hint: "msteams://".to_string(),
        });
    }

    // Cisco Webex
    if t.contains("webex meeting") || t.contains("cisco webex") {
        return Some(DetectedMeeting {
            source: "webex".to_string(),
            title: title.to_string(),
            url_hint: "https://webex.com".to_string(),
        });
    }

    None
}

#[cfg(target_os = "windows")]
fn get_foreground_title() -> Option<String> {
    use std::os::windows::ffi::OsStringExt;
    use std::ffi::OsString;

    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowTextLengthW(hwnd: isize) -> i32;
        fn GetWindowTextW(hwnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
    }

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return None;
        }
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return None;
        }
        let mut buf: Vec<u16> = vec![0u16; (len + 1) as usize];
        let written = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if written == 0 {
            return None;
        }
        buf.truncate(written as usize);
        Some(OsString::from_wide(&buf).to_string_lossy().to_string())
    }
}

#[cfg(target_os = "macos")]
fn get_foreground_title() -> Option<String> {
    // Use osakit / AppleScript to get frontmost window title.
    // Cheap call: `osascript -e 'tell application "System Events" to get name of (first window of (first application process whose frontmost is true))'`
    use std::process::Command;
    let script = r#"tell application "System Events" to get name of (first window of (first application process whose frontmost is true))"#;
    let out = Command::new("osascript").arg("-e").arg(script).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

#[cfg(target_os = "linux")]
fn get_foreground_title() -> Option<String> {
    // xdotool fallback. Skip if not installed.
    use std::process::Command;
    let out = Command::new("xdotool")
        .args(&["getactivewindow", "getwindowname"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

pub fn start_watcher<R: Runtime>(app: AppHandle<R>) -> Arc<AtomicBool> {
    let active = Arc::new(AtomicBool::new(true));
    let active_clone = active.clone();

    tauri::async_runtime::spawn(async move {
        let mut last_detected_title: Option<String> = None;
        log::info!("[window-watcher] started");

        while active_clone.load(Ordering::Relaxed) {
            sleep(Duration::from_millis(POLL_MS)).await;

            let title = match get_foreground_title() {
                Some(t) => t,
                None => continue,
            };

            let detected = match detect_meeting(&title) {
                Some(d) => d,
                None => {
                    // Foreground window is not a meeting — reset memory so we
                    // re-prompt if user switches back to the same meeting later.
                    last_detected_title = None;
                    continue;
                }
            };

            if last_detected_title.as_deref() == Some(&detected.title) {
                continue; // already prompted for this exact title
            }
            last_detected_title = Some(detected.title.clone());

            log::info!("[window-watcher] meeting detected: {} via {}", detected.source, detected.title);
            if let Err(e) = app.emit("active-meeting-detected", &detected) {
                log::warn!("[window-watcher] emit failed: {}", e);
            }
        }

        log::info!("[window-watcher] stopped");
    });

    active
}
