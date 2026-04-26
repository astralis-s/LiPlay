// Prevent the extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Workaround for the tao 0.34.8 panic on certain Linux compositors:
    //   thread 'main' panicked at .../tao-0.34.8/.../event_loop.rs:448:18:
    //   called `Option::unwrap()` on a `None` value
    // Triggered when GDK can't resolve a primary monitor under Wayland.
    // Forcing the X11 backend (via XWayland) sidesteps the upstream bug.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("GDK_BACKEND").is_none() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        // Some webkit2gtk builds need software rendering as a fallback.
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    liplay_lib::run();
}
