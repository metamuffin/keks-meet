/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
use crate::{
    crypto::Key,
    peer::Peer,
    protocol::{self, ClientboundPacket, RelayMessage, RelayMessageWrapper, ServerboundPacket},
    signaling::SignalingConnection,
    Config,
};
use futures_util::{SinkExt, StreamExt};
use log::{debug, info, warn};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use webrtc::api::API;

pub struct State {
    pub conn: SignalingConnection,
    pub config: Config,
    pub api: API,
    pub key: Key,
    pub my_id: RwLock<Option<usize>>,
    pub peers: RwLock<HashMap<usize, Arc<Peer>>>,
}
impl State {
    pub async fn my_id(&self) -> usize {
        self.my_id.read().await.expect("not initialized yet")
    }

    pub async fn receive_loop(self: Arc<Self>) {
        while let Some(packet) = self.conn.recv.write().await.next().await {
            debug!("{packet:?}");
            let state = self.clone();
            state.on_message(packet).await
        }
    }

    pub async fn on_message(self: Arc<Self>, packet: ClientboundPacket) {
        match packet {
            protocol::ClientboundPacket::Init { your_id, version } => {
                info!("server is running {version:?}");
                *self.my_id.write().await = Some(your_id);
            }
            protocol::ClientboundPacket::ClientJoin { id } => {
                if id == self.my_id().await {
                    // we joined - YAY!
                } else {
                    self.peers
                        .write()
                        .await
                        .insert(id, Peer::create(self.clone(), id).await);
                }
            }
            protocol::ClientboundPacket::ClientLeave { id } => {
                self.peers.write().await.remove(&id);
            }
            protocol::ClientboundPacket::Message { sender, message } => {
                let message = self.key.decrypt(&message);
                let p = serde_json::from_str::<RelayMessageWrapper>(&message).unwrap();
                self.on_relay(sender, p.inner).await;
            }
        }
    }

    pub async fn on_relay(&self, sender: usize, p: RelayMessage) {
        if let Some(peer) = self.peers.read().await.get(&sender).cloned() {
            peer.on_relay(p).await
        } else {
            warn!("got a packet from a non-existent peer")
        }
    }

    pub async fn send_relay(&self, recipient: usize, inner: RelayMessage) {
        self.conn
            .send
            .write()
            .await
            .send(ServerboundPacket::Relay {
                recipient: Some(recipient),
                message: self.key.encrypt(
                    &serde_json::to_string(&RelayMessageWrapper {
                        sender: self.my_id.read().await.expect("not ready to relay yet.."),
                        inner,
                    })
                    .unwrap(),
                ),
            })
            .await
            .unwrap()
    }
}
