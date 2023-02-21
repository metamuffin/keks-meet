use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    webrtc: ClientWebrtcConfig,
    appearance: ClientAppearanceConfig,
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
    accent: Option<String>,
}
