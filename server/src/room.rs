/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
use crate::protocol::{ClientboundPacket, ServerboundPacket};
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::{debug, error};
use std::{collections::HashMap, sync::atomic::AtomicUsize, time::Duration};
use tokio::sync::{mpsc, RwLock};
use warp::ws::{Message, WebSocket};

#[derive(Debug, Default)]
pub struct Room {
    pub id_counter: AtomicUsize,
    pub clients: RwLock<HashMap<usize, mpsc::UnboundedSender<ClientboundPacket>>>,
}

impl Room {
    pub async fn client_connect(&self, ws: WebSocket) {
        debug!("new client connected");
        let (mut user_ws_tx, mut user_ws_rx) = ws.split();

        let (tx, mut rx) = mpsc::unbounded_channel();

        let mut g = self.clients.write().await;
        // ensure write guard to client exists when using id_counter
        let id = self
            .id_counter
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        g.insert(id, tx);
        drop(g);
        debug!("assigned id={id}, init connection");

        tokio::task::spawn(async move {
            while let Some(packet) = rx.recv().await {
                debug!("{id}  -> {packet:?}");
                user_ws_tx
                    .send(Message::text(serde_json::to_string(&packet).unwrap()))
                    .unwrap_or_else(|e| {
                        eprintln!("websocket send error: {}", e);
                    })
                    .await;
            }
        });

        self.send_to_client(
            id,
            ClientboundPacket::Init {
                your_id: id,
                version: format!("keks-meet {}", env!("CARGO_PKG_VERSION")),
            },
        )
        .await;

        // send join of this client to all clients
        self.broadcast(None, ClientboundPacket::ClientJoin { id })
            .await;
        // send join of all other clients to this one
        for (&cid, _) in self.clients.read().await.iter() {
            // skip self
            if cid != id {
                self.send_to_client(id, ClientboundPacket::ClientJoin { id: cid })
                    .await;
            }
        }
        debug!("client should be ready!");

        while let Some(result) = user_ws_rx.next().await {
            let msg = match result {
                Ok(msg) => msg,
                Err(e) => {
                    error!("websocket error(id={id}): {e}");
                    break;
                }
            };
            if let Ok(s) = msg.to_str() {
                let p = match serde_json::from_str::<ServerboundPacket>(s) {
                    Ok(p) => p,
                    Err(e) => {
                        error!("client(id={id}) sent invalid packet: {e:?}");
                        break;
                    }
                };
                debug!("{id} <-  {p:?}");
                self.client_message(id, p).await;
            }
        }
        self.clients.write().await.remove(&id);
        self.broadcast(Some(id), ClientboundPacket::ClientLeave { id })
            .await;
    }

    pub async fn broadcast(&self, sender: Option<usize>, packet: ClientboundPacket) {
        for (&id, tx) in self.clients.read().await.iter() {
            if sender != Some(id) {
                let _ = tx.send(packet.clone());
            }
        }
    }
    pub async fn send_to_client(&self, recipient: usize, packet: ClientboundPacket) {
        if let Some(c) = self.clients.read().await.get(&recipient) {
            let _ = c.send(packet);
        }
    }

    pub async fn client_message(&self, sender: usize, packet: ServerboundPacket) {
        match packet {
            ServerboundPacket::Ping => (),
            ServerboundPacket::Relay { recipient, message } => {
                let packet = ClientboundPacket::Message { sender, message };
                // Add some delay for testing scenarios with latency.
                // tokio::time::sleep(Duration::from_millis(1000)).await;
                if let Some(recipient) = recipient {
                    self.send_to_client(recipient, packet).await;
                } else {
                    self.broadcast(Some(sender), packet).await
                }
            }
        }
    }

    pub async fn should_remove(&self) -> bool {
        self.clients.read().await.len() == 0
    }
}
