// Prevent the extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux desktop tweaks. All of these are no-ops on systems where the
    // variable is already set, so users who really want a custom theme can
    // override us. The WebView side of LiPlay does its own theming  GTK
    // chrome here is only window decorations + native dialogs.
    #[cfg(target_os = "linux")]
    {
        // 1. Software rendering for webkit2gtk dodges several GPU-driver
        //    crashes during init.
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }

        // 2. Force Adwaita for the GTK side of the app so a malformed
        //    user theme (Junk at end of value... in gtk.css) can't take
        //    down WebKitWebProcess at init.
        if std::env::var_os("GTK_THEME").is_none() {
            std::env::set_var("GTK_THEME", "Adwaita");
        }

        // 3. Don't try to load third-party gtk-modules (e.g. the
        //    colorreload-gtk-module that ships with some theme bundles)
        //    they're often built against a different libgtk than the one
        //    our AppImage bundles and crash on dlopen.
        std::env::set_var("GTK_MODULES", "");
        std::env::set_var("GTK3_MODULES", "");
    }

    liplay_lib::run();
}
