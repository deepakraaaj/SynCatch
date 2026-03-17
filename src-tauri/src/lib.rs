use tauri::{Emitter, Manager, PhysicalPosition, Position};
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_PATH: &str = "sqlite:mission-control.db";
const TOGGLE_HUD_TRANSPARENCY_EVENT: &str = "missioncontrol://toggle-hud-transparency";
const HUD_WIDTH: u32 = 620;
const HUD_HEIGHT: u32 = 104;
const HUD_MARGIN_X: u32 = 26;
const HUD_MARGIN_Y: u32 = 26;

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

fn position_hud(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("hud") {
        if let Some(monitor) = window.current_monitor()? {
            let size = monitor.size();
            let x = size.width.saturating_sub(HUD_WIDTH + HUD_MARGIN_X) as i32;
            let y = size.height.saturating_sub(HUD_HEIGHT + HUD_MARGIN_Y) as i32;
            window.set_position(Position::Physical(PhysicalPosition::new(x, y)))?;
        }
    }

    Ok(())
}

fn prepare_launch_windows(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("hud") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_PATH, database_migrations())
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let quick_add_shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
                let quick_add_handler_shortcut = quick_add_shortcut.clone();
                let hud_transparency_shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyH);
                let hud_transparency_handler_shortcut = hud_transparency_shortcut.clone();

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
                position_hud(&app.handle())?;
                prepare_launch_windows(&app.handle())?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MissionControl");
}
