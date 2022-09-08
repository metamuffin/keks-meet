use crate::protocol::{ClientboundPacket, ServerboundPacket};
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::{debug, error};
use std::{collections::HashMap, sync::atomic::AtomicUsize};
use tokio::sync::{mpsc, RwLock};
use warp::ws::{Message, WebSocket};

#[derive(Debug)]
pub struct Client {
    pub name: String,
    pub out: mpsc::UnboundedSender<ClientboundPacket>,
}

#[derive(Debug, Default)]
pub struct Room {
    pub id_counter: AtomicUsize,
    pub clients: RwLock<HashMap<usize, Client>>,
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
        let name = format!("user no. {id}");
        g.insert(
            id,
            Client {
                out: tx,
                name: name.clone(),
            },
        );
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
        self.broadcast(None, ClientboundPacket::ClientJoin { id, name })
            .await;
        // send join of all other clients to this one
        for (&cid, c) in self.clients.read().await.iter() {
            // skip self
            if cid != id {
                self.send_to_client(
                    id,
                    ClientboundPacket::ClientJoin {
                        id: cid,
                        name: c.name.clone(),
                    },
                )
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
                let _ = tx.out.send(packet.clone());
            }
        }
    }
    pub async fn send_to_client(&self, recipient: usize, packet: ClientboundPacket) {
        if let Some(c) = self.clients.read().await.get(&recipient) {
            let _ = c.out.send(packet);
        }
    }

    pub async fn client_message(&self, sender: usize, packet: ServerboundPacket) {
        match packet {
            ServerboundPacket::Ping => (),
            ServerboundPacket::Relay { recipient, message } => {
                if let Some(recipient) = recipient {
                    self.send_to_client(recipient, ClientboundPacket::Message { sender, message })
                        .await;
                }
            }
        }
    }

    pub async fn should_remove(&self) -> bool {
        self.clients.read().await.len() == 0
    }
}
