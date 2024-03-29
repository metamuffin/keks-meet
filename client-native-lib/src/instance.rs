/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use crate::{
    build_api,
    crypto::{self, Key},
    peer::Peer,
    protocol::{self, ClientboundPacket, RelayMessage, RelayMessageWrapper, ServerboundPacket},
    signaling::{self, SignalingConnection},
    Config, EventHandler, LocalResource,
};
use futures_util::{SinkExt, StreamExt};
use log::{debug, info, warn};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use webrtc::api::API;

pub struct Instance {
    pub event_handler: Arc<dyn EventHandler>,
    pub conn: SignalingConnection,
    pub config: Config,
    pub api: API,
    key: Key,
    pub local_resources: RwLock<HashMap<String, Box<dyn LocalResource>>>,
    my_id: RwLock<Option<usize>>,
    pub peers: RwLock<HashMap<usize, Arc<Peer>>>,
}

impl Instance {
    pub async fn new(config: Config, event_handler: Arc<dyn EventHandler>) -> Arc<Self> {
        let conn = signaling::SignalingConnection::new(&config.signaling_uri).await;
        let key = crypto::Key::derive(&config.secret);

        Arc::new(Self {
            event_handler,
            api: build_api(),
            my_id: RwLock::new(None),
            peers: Default::default(),
            local_resources: Default::default(),
            config,
            conn,
            key,
        })
    }

    pub async fn spawn_ping(self: &Arc<Self>) {
        let blub = self.clone();
        tokio::spawn(async move {
            loop {
                blub.ping().await;
                debug!("ping");
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
    }

    pub async fn ping(&self) {
        self.conn
            .send
            .write()
            .await
            .send(ServerboundPacket::Ping)
            .await
            .unwrap();
    }

    pub async fn my_id(&self) -> usize {
        self.my_id.read().await.expect("not initialized yet")
    }

    pub async fn receive_loop(self: Arc<Self>) {
        while let Some(packet) = self.conn.recv.write().await.next().await {
            let inst = self.clone();
            inst.on_message(packet).await
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
                    let peer = Peer::create(self.clone(), id).await;
                    self.peers.write().await.insert(id, peer.clone());
                    peer.init_remote().await;
                    self.event_handler.peer_join(peer).await;
                }
            }
            protocol::ClientboundPacket::ClientLeave { id } => {
                let peer = self.peers.write().await.remove(&id).unwrap();
                peer.on_leave().await;
                self.event_handler.peer_leave(peer).await;
            }
            protocol::ClientboundPacket::Message { sender, message } => {
                let message = self.key.decrypt(&message);
                let p = serde_json::from_str::<RelayMessageWrapper>(&message).unwrap();
                if p.sender == sender {
                    self.on_relay(sender, p.inner).await;
                } else {
                    warn!("dropping packet with inconsistent sender")
                }
            }
            protocol::ClientboundPacket::RoomInfo { .. } => {}
        }
    }

    pub async fn on_relay(&self, sender: usize, p: RelayMessage) {
        debug!("(relay) <- ({sender}) {p:?}");
        if let Some(peer) = self.peers.read().await.get(&sender) {
            peer.on_relay(p.clone()).await;
            self.event_handler.on_relay(peer.to_owned(), &p).await;
        } else {
            warn!("got a packet from a non-existent peer")
        }
    }

    pub async fn send_relay(&self, recipient: Option<usize>, inner: RelayMessage) {
        debug!("(relay) -> ({recipient:?}) {inner:?}");
        self.conn
            .send
            .write()
            .await
            .send(ServerboundPacket::Relay {
                recipient,
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

    pub async fn add_local_resource(&self, res: Box<dyn LocalResource>) {
        for (_pid, peer) in self.peers.read().await.iter() {
            peer.send_relay(RelayMessage::Provide(res.info())).await;
        }
        self.local_resources
            .write()
            .await
            .insert(res.info().id, res);
    }
    pub async fn remove_local_resource(&self, id: String) {
        self.local_resources.write().await.remove(&id);
        for (_pid, peer) in self.peers.read().await.iter() {
            peer.send_relay(RelayMessage::ProvideStop { id: id.clone() })
                .await;
        }
    }
}
