#[cfg(target_os = "linux")]
fn is_snap_backed_value(value: &str) -> bool {
    value.contains("/snap/") || value.contains("/var/lib/snapd/")
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
}

fn main() {
    #[cfg(target_os = "linux")]
    sanitize_linux_desktop_environment();

    missioncontrol_lib::run();
}
