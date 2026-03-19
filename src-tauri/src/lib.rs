use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_PATH: &str = "sqlite:mission-control.db";
const TOGGLE_HUD_TRANSPARENCY_EVENT: &str = "missioncontrol://toggle-hud-transparency";
const SHOW_COMPACT_HUD_EVENT: &str = "missioncontrol://show-compact-hud";
const AUTOSTART_LAUNCH_ARG: &str = "--autostart";

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn database_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_tasks_table",
            sql: r#"
              CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                raw_input TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                lane TEXT NOT NULL,
                estimated_minutes INTEGER NOT NULL DEFAULT 25,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_focus_state_table",
            sql: r#"
              CREATE TABLE IF NOT EXISTS focus_state (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                current_active_mission TEXT,
                focus_session_start_time TEXT,
                focus_session_duration INTEGER NOT NULL DEFAULT 45,
                focus_confirmation_prompts INTEGER NOT NULL DEFAULT 0,
                manual_focus_reset INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "expand_focus_state_and_create_app_preferences",
            sql: r#"
              ALTER TABLE focus_state ADD COLUMN status TEXT NOT NULL DEFAULT 'idle';
              ALTER TABLE focus_state ADD COLUMN hud_mode TEXT NOT NULL DEFAULT 'compact';
              ALTER TABLE focus_state ADD COLUMN hud_transparency TEXT NOT NULL DEFAULT 'standard';

              CREATE TABLE IF NOT EXISTS app_preferences (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_activity_log_table",
            sql: r#"
              CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY NOT NULL,
                action TEXT NOT NULL,
                source TEXT NOT NULL,
                task_id TEXT,
                details TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_focus_elapsed_seconds",
            sql: r#"
              ALTER TABLE focus_state ADD COLUMN focus_elapsed_seconds INTEGER NOT NULL DEFAULT 0;
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "expand_tasks_with_brief_fields",
            sql: r#"
              ALTER TABLE tasks ADD COLUMN goal TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN definition_of_done TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN next_action TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN why_it_matters TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN workspace_notes TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN subtasks_json TEXT NOT NULL DEFAULT '[]';
              ALTER TABLE tasks ADD COLUMN clarifying_questions_json TEXT NOT NULL DEFAULT '[]';
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

fn show_quick_add(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("quick-add") {
        window.show()?;
        window.set_focus()?;
        app.emit_to("quick-add", "quick-add:focus", ())?;
    }

    Ok(())
}

fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == AUTOSTART_LAUNCH_ARG)
}

fn prepare_autostart_launch_windows(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("hud") {
        window.show()?;
        window.unminimize()?;
    }

    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }

    Ok(())
}

fn prepare_manual_launch_windows(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("hud") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
        app.emit_to("hud", SHOW_COMPACT_HUD_EVENT, ())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Err(error) = prepare_manual_launch_windows(&app) {
                eprintln!("single instance relaunch error: {error}");
            }
        }));
    }

    builder
        .invoke_handler(tauri::generate_handler![quit_app])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_PATH, database_migrations())
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let launched_from_autostart = is_autostart_launch();
                let quick_add_shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
                let quick_add_handler_shortcut = quick_add_shortcut.clone();
                let hud_transparency_shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyH);
                let hud_transparency_handler_shortcut = hud_transparency_shortcut.clone();

                app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    Some(vec![AUTOSTART_LAUNCH_ARG]),
                ))?;

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app_handle, pressed_shortcut, event| {
                            if pressed_shortcut == &quick_add_handler_shortcut
                                && event.state() == ShortcutState::Pressed
                            {
                                if let Err(error) = show_quick_add(app_handle) {
                                    eprintln!("quick add shortcut error: {error}");
                                }
                            }

                            if pressed_shortcut == &hud_transparency_handler_shortcut
                                && event.state() == ShortcutState::Pressed
                            {
                                if let Err(error) = app_handle.emit_to(
                                    "hud",
                                    TOGGLE_HUD_TRANSPARENCY_EVENT,
                                    (),
                                ) {
                                    eprintln!("hud transparency shortcut error: {error}");
                                }
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(quick_add_shortcut)?;
                app.global_shortcut().register(hud_transparency_shortcut)?;

                if launched_from_autostart {
                    prepare_autostart_launch_windows(&app.handle())?;
                } else {
                    prepare_manual_launch_windows(&app.handle())?;
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MissionControl");
}
