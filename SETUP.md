# SETUP — Meetily Extended (Windows)

Phase 1 output. Build + run procedure for the unmodified fork after rebrand.

---

## Prerequisites

Install these once. All free.

| Tool | Why | Install |
|---|---|---|
| Node.js 22 LTS | Frontend + Tauri CLI | https://nodejs.org |
| pnpm 9+ | Meetily uses pnpm, not npm | `npm i -g pnpm` |
| Rust (stable, MSVC toolchain) | Tauri native + whisper-rs | https://rustup.rs → choose `x86_64-pc-windows-msvc` |
| Visual Studio Build Tools 2022 | C++ compiler for whisper-rs/cpal | https://aka.ms/vs/17/release/vs_buildtools.exe → select **Desktop development with C++** |
| CMake 3.20+ | Builds whisper.cpp | `winget install Kitware.CMake` |
| Python 3.11+ | Backend FastAPI | `winget install Python.Python.3.11` |
| Git | Submodule init | already present |
| ffmpeg | Audio sidecar | `winget install Gyan.FFmpeg` |

GPU acceleration is optional. Default Windows build uses Vulkan (see `frontend/src-tauri/Cargo.toml` target deps).

---

## 1. Initial repo bootstrap (one-time)

```powershell
cd "E:\MacNetwork\Meetily Extended"

# whisper.cpp submodule (not pulled by the shallow clone)
git submodule add -b develop https://github.com/Zackriya-Solutions/whisper.cpp backend/whisper.cpp
git submodule update --init --recursive
```

If `git submodule add` complains the path already exists with the `.gitmodules` entry, run instead:

```powershell
git submodule update --init --recursive
```

---

## 2. Build whisper backend

```powershell
cd "E:\MacNetwork\Meetily Extended\backend"
.\build_whisper.cmd small.en
```

Downloads the `small.en` ggml model (~244MB) and compiles whisper-server. Output binary in `backend/whisper-server-package/`.

If you want a different model later: `tiny.en`, `base.en`, `medium.en`, `large-v3-turbo`. Bigger = more accurate, slower.

---

## 3. Frontend deps

```powershell
cd "E:\MacNetwork\Meetily Extended\frontend"
pnpm install
```

First install pulls Tauri CLI + all React deps (~700 packages). Allow ~3 min on first run.

---

## 4. Run dev mode

Open **two PowerShell windows**.

**Window 1 — Backend (FastAPI on :5167):**
```powershell
cd "E:\MacNetwork\Meetily Extended\backend"
.\start_with_output.ps1
```

**Window 2 — Frontend (Tauri dev on :3118 + native window):**
```powershell
cd "E:\MacNetwork\Meetily Extended\frontend"
pnpm tauri:dev
```

First Tauri dev compile takes ~15 min (whisper-rs is large). Subsequent rebuilds are seconds.

You should see a native window titled **Meetily Extended**.

---

## 5. Verify capture pipeline

1. App launches, transcribes a 30s test recording.
2. Click record → speak → stop.
3. Check `%APPDATA%\com.meetily.extended\meeting_minutes.sqlite` exists and has a row in `meetings`.
4. Summary appears in the right pane after Ollama (or configured LLM) processes it.

---

## Known Windows gotchas

| Symptom | Fix |
|---|---|
| `link.exe not found` | Install VS Build Tools with C++ workload. Reboot. |
| `cmake not found` during whisper build | `winget install Kitware.CMake` then open a **new** PowerShell. |
| `MSB8066` C++ build error | Use the **x64 Native Tools Command Prompt for VS 2022** instead of regular PowerShell. |
| WASAPI loopback silent | Default playback device must be active (not muted). Output through speakers, not Bluetooth (see `BLUETOOTH_PLAYBACK_NOTICE.md`). |
| Tauri build hangs on `whisper-rs` | First compile is 10-15 min. Don't kill it. |
| `pnpm tauri:dev` fails with `failed to load Cargo.toml` | Run from `frontend/`, not repo root. Workspace `Cargo.toml` at root is intentional. |

---

## What changed from upstream

Listed for the diff:

| File | Change |
|---|---|
| `frontend/package.json` | name → `meetily-extended`, version → `1.0.0-extended.0` |
| `frontend/src-tauri/tauri.conf.json` | productName → `Meetily Extended`, version → `1.0.0-extended.0`, identifier → `com.meetily.extended`, window title → `Meetily Extended` |
| `frontend/src-tauri/Cargo.toml` | package name → `meetily-extended`, authors, description |
| `.gitignore` | added `/upstream/`, `/logs/`, `*.tmsf`, `.electron-cache/` |

Bundle id change means the new app uses `%APPDATA%\com.meetily.extended\` instead of the upstream `com.meetily.ai\`. **Existing upstream Meetily users:** their old data stays in `com.meetily.ai\` and is not auto-migrated. Phase 3 will add an import wizard.

---

## ✅ Phase 1 deliverable

Rebranded fork builds and runs on Windows. Capture pipeline produces a transcript + summary in the new SQLite location. Documented above.

Full smoke test (record → transcribe → summarize) requires the user to run §1–§4 — Claude can't drive the Tauri GUI from CI. Screenshot proof will be appended to this file after first successful local run.
