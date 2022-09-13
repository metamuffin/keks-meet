use serde::{Deserialize, Serialize};
use webrtc::peer_connection::sdp::sdp_type::RTCSdpType;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientboundPacket {
    Init { your_id: usize, version: String },
    ClientJoin { id: usize },
    ClientLeave { id: usize },
    Message { sender: usize, message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerboundPacket {
    Ping,
    Relay {
        recipient: Option<usize>,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayMessageWrapper {
    sender: usize, // redundant, but ensures the server didnt cheat
    inner: RelayMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelayMessage {
    Offer(RTCSessionDescriptionInit),
    Answer(RTCSessionDescriptionInit),
    IceCandidate(RTCIceCandidateInit),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RTCSessionDescriptionInit {
    #[serde(rename = "type")]
    pub ty: RTCSdpType,
    pub sdp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RTCIceCandidateInit {
    pub candidate: String,
    pub sdp_m_line_index: Option<usize>,
    pub sdp_mid: Option<String>,
    pub username_fragment: Option<String>,
}
