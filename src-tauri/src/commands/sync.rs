use serde::Serialize;
use tauri::State;

use super::CmdResult;
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct LocalServerInfo {
    pub host: String,
    pub port: u16,
    pub url: String,
    pub ws_url: String,
}

#[tauri::command]
pub async fn local_server_info(state: State<'_, AppState>) -> CmdResult<LocalServerInfo> {
    let port = state.server.bind_port;
    let host = state.server.local_ip
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".into());
    Ok(LocalServerInfo {
        url:    format!("http://{}:{}", host, port),
        ws_url: format!("ws://{}:{}/ws/listen", host, port),
        host,
        port,
    })
}

/// Render a Listen Together QR as an SVG string. Doing it in Rust avoids
/// pulling a JS QR library; the frontend can drop the SVG into an <img src=
/// "data:image/svg+xml;..."> or render it raw.
#[tauri::command]
pub async fn listen_together_qr(state: State<'_, AppState>) -> CmdResult<String> {
    let info = local_server_info(state).await?;
    let payload = format!(r#"{{"v":1,"url":"{}","ws":"{}"}}"#, info.url, info.ws_url);
    let code = qrcode::QrCode::new(payload.as_bytes())
        .map_err(|e| super::CmdError::Invalid(format!("qr: {e}")))?;
    let svg = code.render::<qrcode::render::svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(false)
        .dark_color(qrcode::render::svg::Color("#0a0a0c"))
        .light_color(qrcode::render::svg::Color("#ffffff"))
        .build();
    Ok(svg)
}
