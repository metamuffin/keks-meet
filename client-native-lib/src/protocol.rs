/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
use serde::{Deserialize, Serialize};
use webrtc::{
    ice_transport::ice_candidate::RTCIceCandidateInit, peer_connection::sdp::sdp_type::RTCSdpType,
};

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
    pub sender: usize, // redundant, but ensures the server didnt cheat
    pub inner: RelayMessage,
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
