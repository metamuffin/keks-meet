/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub features: FeaturesConfig,
    pub webrtc: WebrtcConfig,
    pub appearance: AppearanceConfig,
}

#[rustfmt::skip]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeaturesConfig {
    #[serde(default)] pub room_watches: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebrtcConfig {
    pub stun: String,
    pub turn: Option<String>,
    pub turn_user: Option<String>,
    pub turn_cred: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    pub accent: String,
    pub accent_light: String,
    pub accent_dark: String,
    pub background: String,
    pub background_dark: String,
    pub background_light: String,
}
