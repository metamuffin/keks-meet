use crate::protocol::{ClientboundPacket, ServerboundPacket};
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::error;
use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};
use warp::ws::{Message, WebSocket};

#[derive(Debug)]
pub struct Client {
    out: mpsc::UnboundedSender<ClientboundPacket>,
}

#[derive(Debug, Default)]
pub struct Room {
    clients: RwLock<HashMap<usize, Client>>,
}

impl Room {
    pub async fn client_connect(&self, ws: WebSocket) {
        let (mut user_ws_tx, mut user_ws_rx) = ws.split();

        let (tx, mut rx) = mpsc::unbounded_channel();

        tokio::task::spawn(async move {
            while let Some(packet) = rx.recv().await {
                user_ws_tx
                    .send(Message::text(serde_json::to_string(&packet).unwrap()))
                    .unwrap_or_else(|e| {
                        eprintln!("websocket send error: {}", e);
                    })
                    .await;
            }
        });

        let id = {
            let mut g = self.clients.write().await;
            let id = g.len();
            g.insert(id, Client { out: tx });
            id
        };

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
                self.client_message(id, p).await;
            };
        }

        self.clients.write().await.remove(&id);
    }

    pub async fn client_message(&self, sender: usize, packet: ServerboundPacket) {
        for (&id, tx) in self.clients.read().await.iter() {
            if sender != id {
                let _ = tx.out.send(todo!());
            }
        }
    }

    pub async fn should_remove(&self) -> bool {
        self.clients.read().await.len() == 0
    }
}
