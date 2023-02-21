use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    webrtc: ClientWebrtcConfig,
    appearance: Option<ClientAppearanceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientWebrtcConfig {
    stun: String,
    turn: Option<String>,
    turn_user: Option<String>,
    turn_cred: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientAppearanceConfig {
    accent: String,
    accent_light: String,
    accent_dark: String,
    background: String,
    background_dark: String,
}
