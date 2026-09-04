use tauri_plugin_sql::{Migration, MigrationKind};

mod meeting_detection;

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
    ];

    tauri::Builder::default()
        .manage(meeting_detection::managed_service())
        .invoke_handler(tauri::generate_handler![
            meeting_detection::meeting_detector_start,
            meeting_detection::meeting_detector_stop,
            meeting_detection::meeting_detector_poll,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:time-tracker.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running time tracker");
}
