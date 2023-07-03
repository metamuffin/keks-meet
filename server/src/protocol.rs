/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin@disroot.org>
*/
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
