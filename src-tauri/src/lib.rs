#[cfg(desktop)]
use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_PATH: &str = "sqlite:mission-control.db";
#[cfg(desktop)]
const TOGGLE_HUD_TRANSPARENCY_EVENT: &str = "missioncontrol://toggle-hud-transparency";
#[cfg(desktop)]
const SHOW_COMPACT_HUD_EVENT: &str = "missioncontrol://show-compact-hud";
#[cfg(desktop)]
const SHOW_HUD_TASK_COMPOSER_EVENT: &str = "missioncontrol://show-hud-task-composer";
#[cfg(desktop)]
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
        Migration {
            version: 7,
            description: "create_missions_table",
            sql: r#"
              CREATE TABLE IF NOT EXISTS missions (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '🎯',
                color TEXT NOT NULL DEFAULT 'blue',
                objective TEXT NOT NULL DEFAULT '',
                why_it_matters TEXT NOT NULL DEFAULT '',
                definition_of_success TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                started_at TEXT,
                completed_at TEXT,
                target_date TEXT,
                estimated_hours REAL NOT NULL DEFAULT 0,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                tags_json TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_mission_id_to_tasks",
            sql: r#"
              ALTER TABLE tasks ADD COLUMN mission_id TEXT;
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "task_model_redesign",
            sql: r#"
              ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;
              ALTER TABLE tasks ADD COLUMN outcome TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN notes TEXT NOT NULL DEFAULT '';
              ALTER TABLE tasks ADD COLUMN energy TEXT NOT NULL DEFAULT 'shallow';
              ALTER TABLE tasks ADD COLUMN due_date TEXT;
              ALTER TABLE tasks ADD COLUMN scheduled_for TEXT;
              ALTER TABLE tasks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
              ALTER TABLE tasks ADD COLUMN completed_at TEXT;
              UPDATE tasks SET
                outcome = CASE
                  WHEN definition_of_done != '' THEN definition_of_done
                  WHEN goal != '' THEN goal
                  ELSE ''
                END,
                notes = CASE
                  WHEN description != '' AND workspace_notes != ''
                    THEN description || char(10) || char(10) || workspace_notes
                  WHEN description != '' THEN description
                  WHEN workspace_notes != '' THEN workspace_notes
                  ELSE ''
                END,
                completed_at = CASE WHEN status = 'done' THEN updated_at ELSE NULL END;
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create_journal_tables",
            sql: r#"
              CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY NOT NULL,
                kind TEXT NOT NULL CHECK (kind IN ('regret', 'manifestation', 'best_moment', 'lesson')),
                content TEXT NOT NULL,
                entry_date TEXT NOT NULL,
                linked_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
                mission_id TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
              CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date DESC);
              CREATE INDEX IF NOT EXISTS idx_journal_entries_updated_at ON journal_entries(updated_at DESC);

              CREATE TABLE IF NOT EXISTS journal_days (
                entry_date TEXT PRIMARY KEY NOT NULL,
                mood INTEGER NOT NULL DEFAULT 0 CHECK (mood >= 0 AND mood <= 5),
                gratitude TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "create_sync_outbox",
            sql: r#"
              CREATE TABLE IF NOT EXISTS sync_outbox (
                id TEXT PRIMARY KEY NOT NULL,
                table_name TEXT NOT NULL,
                row_id TEXT NOT NULL,
                operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
                payload TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                synced_at TEXT,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
              );
              CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending
                ON sync_outbox(synced_at, created_at);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create_notes_tables",
            sql: r#"
              CREATE TABLE IF NOT EXISTS note_categories (
                id TEXT PRIMARY KEY NOT NULL,
                label TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT 'slate',
                icon TEXT NOT NULL DEFAULT 'Tag',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );

              CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                category_id TEXT NOT NULL DEFAULT 'general',
                mission_id TEXT,
                pinned INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
              CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
              CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_task_completion_note",
            sql: r#"
              ALTER TABLE tasks ADD COLUMN completion_note TEXT NOT NULL DEFAULT '';
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add_collaborators_and_task_assignees",
            sql: r#"
              ALTER TABLE tasks ADD COLUMN assignee_ids_json TEXT NOT NULL DEFAULT '[]';

              CREATE TABLE IF NOT EXISTS collaborators (
                id TEXT PRIMARY KEY NOT NULL,
                user_id TEXT NOT NULL,
                display_name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
              CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(desktop)]
fn show_hud_task_composer(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("hud") {
        window.show()?;
        window.unminimize()?;
        window.set_always_on_top(true)?;
        window.set_visible_on_all_workspaces(true)?;
        window.set_focus()?;
        app.emit_to("hud", SHOW_HUD_TASK_COMPOSER_EVENT, ())?;
    }

    Ok(())
}

#[cfg(desktop)]
fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == AUTOSTART_LAUNCH_ARG)
}

#[cfg(desktop)]
fn prepare_autostart_launch_windows(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("hud") {
        window.show()?;
        window.unminimize()?;
        window.set_always_on_top(true)?;
        window.set_visible_on_all_workspaces(true)?;
        app.emit_to("hud", SHOW_COMPACT_HUD_EVENT, ())?;
    }

    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide()?;
    }

    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }

    Ok(())
}

#[cfg(desktop)]
fn prepare_manual_launch_windows(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }

    if let Some(window) = app.get_webview_window("quick-add") {
        window.hide()?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // On GNOME under Wayland, native Wayland windows can't be kept "always on top" -
    // GTK silently ignores the request, so the HUD gets buried behind whichever app
    // is focused and looks like it vanished. Running the GTK windows through XWayland
    // (where _NET_WM_STATE_ABOVE is honored) keeps the HUD visible. Respect an
    // existing GDK_BACKEND so users who rely on native Wayland can opt back out.
    #[cfg(all(desktop, target_os = "linux"))]
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }

    #[cfg(desktop)]
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Err(error) = prepare_manual_launch_windows(&app) {
                eprintln!("single instance relaunch error: {error}");
            }
        }));

    #[cfg(not(desktop))]
    let builder = tauri::Builder::default();

    builder
        .invoke_handler(tauri::generate_handler![quit_app])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_PATH, database_migrations())
                .build(),
        )
        .setup(|app| {
            #[cfg(not(desktop))]
            let _ = app;

            #[cfg(desktop)]
            {
                use tauri::WebviewWindowBuilder;
                use tauri::WebviewUrl;
                use tauri_plugin_autostart::MacosLauncher;
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                // Create desktop-only windows dynamically (kept out of tauri.conf.json so Android never sees them)
                let hud_window = WebviewWindowBuilder::new(app, "hud", WebviewUrl::App("hud.html".into()))
                    .title("MissionControl HUD")
                    .inner_size(360.0, 78.0)
                    .resizable(false)
                    .decorations(false)
                    .transparent(true)
                    .always_on_top(true)
                    .visible_on_all_workspaces(true)
                    .skip_taskbar(false)
                    .focused(false)
                    .visible(false)
                    .build()?;

                // Some Linux window managers drop the always-on-top hint when another
                // window is activated, letting the HUD fall behind it. Re-assert the
                // hint whenever the HUD loses focus so it stays on top.
                let hud_window_for_focus = hud_window.clone();
                hud_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = hud_window_for_focus.set_always_on_top(true);
                        let _ = hud_window_for_focus.set_visible_on_all_workspaces(true);
                    }
                });

                WebviewWindowBuilder::new(app, "quick-add", WebviewUrl::App("quick-add.html".into()))
                    .title("MissionControl Quick Add")
                    .inner_size(540.0, 560.0)
                    .center()
                    .resizable(false)
                    .decorations(false)
                    .transparent(true)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .visible(false)
                    .build()?;

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
                                if let Err(error) = show_hud_task_composer(app_handle) {
                                    eprintln!("hud task composer shortcut error: {error}");
                                }
                            }

                            if pressed_shortcut == &hud_transparency_handler_shortcut
                                && event.state() == ShortcutState::Pressed
                            {
                                if let Err(error) =
                                    app_handle.emit_to("hud", TOGGLE_HUD_TRANSPARENCY_EVENT, ())
                                {
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
