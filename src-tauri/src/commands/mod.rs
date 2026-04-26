pub mod library;
pub mod lyrics;
pub mod playback;
pub mod tags;

use serde::Serialize;

/// All command results funnel through this Result so the JS side gets a
/// consistent `{ok, err}` shape via Tauri's serde error mapping.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum CmdError {
    #[error("io: {0}")]
    Io(String),
    #[error("db: {0}")]
    Db(String),
    #[allow(dead_code)]
    #[error("audio: {0}")]
    Audio(String),
    #[error("invalid: {0}")]
    Invalid(String),
}

impl From<anyhow::Error> for CmdError {
    fn from(e: anyhow::Error) -> Self { CmdError::Invalid(e.to_string()) }
}
impl From<sqlx::Error> for CmdError {
    fn from(e: sqlx::Error) -> Self { CmdError::Db(e.to_string()) }
}
impl From<std::io::Error> for CmdError {
    fn from(e: std::io::Error) -> Self { CmdError::Io(e.to_string()) }
}
impl From<reqwest::Error> for CmdError {
    fn from(e: reqwest::Error) -> Self { CmdError::Invalid(e.to_string()) }
}

pub type CmdResult<T> = Result<T, CmdError>;
