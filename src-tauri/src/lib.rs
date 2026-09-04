use std::{sync::Mutex, time::Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_sql::{Migration, MigrationKind};

mod meeting_detection;

struct TrayControls {
    start: MenuItem<Wry>,
    stop: MenuItem<Wry>,
}

struct ActiveTrayTimer {
    base_elapsed_seconds: u64,
    observed_at: Instant,
    label: String,
}

#[derive(Default)]
struct TrayTimerState(Mutex<Option<ActiveTrayTimer>>);

fn format_tray_duration(seconds: u64) -> String {
    format!(
        "{:02}:{:02}:{:02}",
        seconds / 3600,
        (seconds % 3600) / 60,
        seconds % 60
    )
}

#[cfg(test)]
mod tray_tests {
    use super::format_tray_duration;

    #[test]
    fn formats_tray_duration_without_losing_seconds() {
        assert_eq!(format_tray_duration(0), "00:00:00");
        assert_eq!(format_tray_duration(3_727), "01:02:07");
        assert_eq!(format_tray_duration(90_061), "25:01:01");
    }
}

fn refresh_tray(
    app: &AppHandle,
    timer: &TrayTimerState,
    controls: &TrayControls,
) -> Result<(), String> {
    let display = timer
        .0
        .lock()
        .map_err(|_| "Tray timer state is unavailable.")?
        .as_ref()
        .map(|timer| {
            let seconds = timer.base_elapsed_seconds + timer.observed_at.elapsed().as_secs();
            (format_tray_duration(seconds), timer.label.clone())
        });
    let tray = app
        .tray_by_id("time-tracker")
        .ok_or("Tray icon is unavailable.")?;
    match display {
        Some((duration, label)) => {
            tray.set_title(Some(&duration))
                .map_err(|error| error.to_string())?;
            tray.set_tooltip(Some(format!("Time Tracker — {label} — {duration}")))
                .map_err(|error| error.to_string())?;
            controls
                .start
                .set_enabled(false)
                .map_err(|error| error.to_string())?;
            controls
                .stop
                .set_enabled(true)
                .map_err(|error| error.to_string())?;
            controls
                .stop
                .set_text(format!("Stop {label} — {duration}"))
                .map_err(|error| error.to_string())?;
        }
        None => {
            tray.set_title(Some("00:00:00"))
                .map_err(|error| error.to_string())?;
            tray.set_tooltip(Some("Time Tracker — Ready — 00:00:00"))
                .map_err(|error| error.to_string())?;
            controls
                .start
                .set_enabled(true)
                .map_err(|error| error.to_string())?;
            controls
                .stop
                .set_enabled(false)
                .map_err(|error| error.to_string())?;
            controls
                .stop
                .set_text("Stop Active Tracking")
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn tray_set_tracking_state(
    app: AppHandle,
    state: State<'_, TrayTimerState>,
    controls: State<'_, TrayControls>,
    active: bool,
    elapsed_seconds: u64,
    label: String,
) -> Result<(), String> {
    *state
        .0
        .lock()
        .map_err(|_| "Tray timer state is unavailable.")? = active.then(|| ActiveTrayTimer {
        base_elapsed_seconds: elapsed_seconds,
        observed_at: Instant::now(),
        label,
    });
    refresh_tray(&app, &state, &controls)
}

fn show_quick_start(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-start") {
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        "quick-start",
        WebviewUrl::App("index.html?view=quick-start".into()),
    )
    .title("Start New Timer")
    .inner_size(460.0, 500.0)
    .min_inner_size(420.0, 460.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .always_on_top(true)
    .center()
    .focused(true)
    .build()
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn open_quick_start(app: AppHandle) -> Result<(), String> {
    show_quick_start(&app)
}

#[tauri::command]
fn close_quick_start(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-start") {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "meeting_sessions",
            sql: include_str!("../migrations/0002_meeting_sessions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "idempotent_meeting_finalization",
            sql: include_str!("../migrations/0003_idempotent_meeting_finalization.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "customer_favorites",
            sql: include_str!("../migrations/0004_customer_favorites.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(TrayTimerState::default())
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Time Tracker", true, None::<&str>)?;
            let start = MenuItem::with_id(app, "start", "Start New Timer", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "Stop Active Tracking", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &start, &stop, &quit])?;
            app.manage(TrayControls { start, stop });
            let mut tray = TrayIconBuilder::with_id("time-tracker")
                .title("00:00:00")
                .tooltip("Time Tracker — Ready — 00:00:00")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        show_main_window(app);
                    }
                    "start" => {
                        let _ = show_quick_start(app);
                    }
                    "stop" => {
                        let _ = app.emit("tray-stop-active-tracking", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;
            let app_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(1));
                let timer = app_handle.state::<TrayTimerState>();
                let controls = app_handle.state::<TrayControls>();
                if timer.0.lock().map(|state| state.is_some()).unwrap_or(false) {
                    let _ = refresh_tray(&app_handle, &timer, &controls);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .manage(meeting_detection::managed_service())
        .invoke_handler(tauri::generate_handler![
            meeting_detection::meeting_detector_start,
            meeting_detection::meeting_detector_stop,
            meeting_detection::meeting_detector_poll,
            tray_set_tracking_state,
            open_quick_start,
            close_quick_start,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:time-tracker.db", migrations)
                .build(),
        )
        .build(tauri::generate_context!())
        .expect("error while building time tracker")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main_window(_app);
            }
        });
}
