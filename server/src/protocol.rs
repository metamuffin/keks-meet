use serde::{Deserialize, Serialize};

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
