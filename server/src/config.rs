use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    pub webrtc: ClientWebrtcConfig,
    pub appearance: ClientAppearanceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientWebrtcConfig {
    pub stun: String,
    pub turn: Option<String>,
    pub turn_user: Option<String>,
    pub turn_cred: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientAppearanceConfig {
    pub accent: String,
    pub accent_light: String,
    pub accent_dark: String,
    pub background: String,
    pub background_dark: String,
}
