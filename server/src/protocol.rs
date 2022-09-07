use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientboundPacket {}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerboundPacket {
    Answer { receiver: usize },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RTCSdpType {
    Answer,
    Offer,
    PRAnswer,
    Rollback,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct RTCSessionDescriptionInit {
    sdp: String,
    #[serde(rename = "type")]
    ty: RTCSdpType,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct RTCIceCandidateInit {
    candidate: Option<String>,
    #[serde(rename = "sdpMLineIndex")]
    sdp_mline_index: Option<i32>,
    #[serde(rename = "sdpMid")]
    sdp_mid: Option<String>,
    #[serde(rename = "usernameFragment")]
    username_fragment: Option<String>,
}
