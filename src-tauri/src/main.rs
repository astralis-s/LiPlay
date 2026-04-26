// Prevent the extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Keep WebKit on its software-only path. On many Linux GPUs the
    // hardware compositing path crashes inside webkit2gtk during init.
    // Cheap on a music UI; never worth the random aborts.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    liplay_lib::run();
}
