/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use serde::{Deserialize, Serialize};

use crate::logic::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientboundPacket {
    Init { your_id: Client, version: String },
    ClientJoin { id: Client },
    ClientLeave { id: Client },
    Message { sender: Client, message: String },
    RoomInfo { hash: String, user_count: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerboundPacket {
    Join {
        hash: Option<String>,
    },
    Ping,
    Relay {
        recipient: Option<Client>,
        message: String,
    },
    WatchRooms(Vec<String>),
}
