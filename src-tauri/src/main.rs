#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn is_snap_backed_value(value: &str) -> bool {
    value.contains("/snap/") || value.contains("/var/lib/snapd/")
}

#[cfg(target_os = "linux")]
fn env_var_is_present(key: &str) -> bool {
    std::env::var(key)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn normalize_linux_display_backend() {
    let has_x11_display = env_var_is_present("DISPLAY");
    let has_wayland_display = env_var_is_present("WAYLAND_DISPLAY");
    let configured_backend = std::env::var("GDK_BACKEND")
        .ok()
        .map(|value| value.trim().to_ascii_lowercase());

    if has_x11_display && !has_wayland_display {
        if configured_backend
            .as_deref()
            .is_none_or(|backend| backend == "wayland")
        {
            std::env::set_var("GDK_BACKEND", "x11");
        }
    }

    if has_wayland_display && !has_x11_display {
        if configured_backend
            .as_deref()
            .is_none_or(|backend| backend == "x11")
        {
            std::env::set_var("GDK_BACKEND", "wayland");
        }
    }
}

#[cfg(target_os = "linux")]
fn sanitize_linux_desktop_environment() {
    let strip_if_snap_backed = [
        "GTK_PATH",
        "GIO_MODULE_DIR",
        "GDK_PIXBUF_MODULEDIR",
        "GDK_PIXBUF_MODULE_FILE",
        "GTK_EXE_PREFIX",
        "GTK_DATA_PREFIX",
        "GTK_IM_MODULE_FILE",
        "GI_TYPELIB_PATH",
    ];

    for key in strip_if_snap_backed {
        if let Ok(value) = std::env::var(key) {
            if is_snap_backed_value(&value) {
                std::env::remove_var(key);
            }
        }
    }

    let snap_keys = std::env::vars()
        .filter_map(|(key, _)| (key == "SNAP" || key.starts_with("SNAP_")).then_some(key))
        .collect::<Vec<_>>();

    for key in snap_keys {
        std::env::remove_var(key);
    }

    let filtered_xdg_data_dirs = std::env::var("XDG_DATA_DIRS")
        .ok()
        .map(|value| {
            value
                .split(':')
                .filter(|entry| !entry.is_empty() && !is_snap_backed_value(entry))
                .collect::<Vec<_>>()
                .join(":")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "/usr/local/share:/usr/share".to_string());

    std::env::set_var("XDG_DATA_DIRS", filtered_xdg_data_dirs);

    normalize_linux_display_backend();

    // Preserve explicit user overrides, but default away from the GBM/EGL
    // paths that commonly abort in WebKitGTK on some Linux driver stacks.
    for key in [
        "WEBKIT_DISABLE_DMABUF_RENDERER",
        "WEBKIT_DMABUF_RENDERER_DISABLE_GBM",
        "WEBKIT_WEBGL_DISABLE_GBM",
    ] {
        if std::env::var_os(key).is_none() {
            std::env::set_var(key, "1");
        }
    }
}

#[cfg(target_os = "linux")]
fn ensure_linux_display_session() {
    if env_var_is_present("DISPLAY") || env_var_is_present("WAYLAND_DISPLAY") {
        return;
    }

    eprintln!();
    eprintln!("MissionControl could not find a Linux desktop display session.");
    eprintln!();
    eprintln!("Expected one of these to be set:");
    eprintln!("- DISPLAY for X11");
    eprintln!("- WAYLAND_DISPLAY for Wayland");
    eprintln!();
    eprintln!("Fix options:");
    eprintln!("1. Run MissionControl from a terminal inside your desktop session");
    eprintln!("2. Or export DISPLAY / WAYLAND_DISPLAY before launching Tauri");
    eprintln!();

    std::process::exit(1);
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        sanitize_linux_desktop_environment();
        ensure_linux_display_session();
    }

    missioncontrol_lib::run();
}
