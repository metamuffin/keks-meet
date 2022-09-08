use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientboundPacket {
    Init {
        your_id: usize,
        version: String,
    },
    ClientJoin {
        id: usize,
        name: String,
    },
    ClientLeave {
        id: usize,
    },
    Message {
        sender: usize,
        message: RelayMessage,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerboundPacket {
    Ping,
    Relay {
        recipient: Option<usize>,
        message: RelayMessage,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelayMessage {
    Offer(RTCSessionDescriptionInit),
    Answer(RTCSessionDescriptionInit),
    IceCandidate(RTCIceCandidateInit),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RTCSdpType {
    Answer,
    Offer,
    PRAnswer,
    Rollback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RTCSessionDescriptionInit {
    sdp: String,
    #[serde(rename = "type")]
    ty: RTCSdpType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RTCIceCandidateInit {
    candidate: Option<String>,
    #[serde(rename = "sdpMLineIndex")]
    sdp_mline_index: Option<i32>,
    #[serde(rename = "sdpMid")]
    sdp_mid: Option<String>,
    #[serde(rename = "usernameFragment")]
    username_fragment: Option<String>,
}
