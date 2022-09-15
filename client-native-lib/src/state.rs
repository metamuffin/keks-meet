use std::{collections::HashMap, pin::Pin, sync::Arc};

use futures_util::Future;
use log::warn;
use tokio::sync::{mpsc::UnboundedSender, RwLock};
use webrtc::api::API;

use crate::{
    crypto::Key,
    peer::Peer,
    protocol::{self, ClientboundPacket, RelayMessage, RelayMessageWrapper, ServerboundPacket},
    Config,
};

pub trait HasPeer {
    fn peer(&self) -> &Arc<Peer>;
}
pub trait PeerInit<P> {
    fn add_peer(
        &self,
        p: Arc<Peer>,
    ) -> Pin<Box<dyn Future<Output = Arc<P>> + 'static + Send + Sync>>;
}

pub struct State<P: HasPeer, I: PeerInit<P>> {
    pub sup: Arc<I>,
    pub config: Config,
    pub api: API,
    pub key: Key,
    pub my_id: RwLock<Option<usize>>,
    pub sender: UnboundedSender<ServerboundPacket>,
    pub peers: RwLock<HashMap<usize, Arc<P>>>,
    pub relay_tx: UnboundedSender<(usize, RelayMessage)>,
}
impl<P: HasPeer, I: PeerInit<P>> State<P, I> {
    pub async fn my_id(&self) -> usize {
        self.my_id.read().await.expect("not initialized yet")
    }

    pub async fn on_message(self: Arc<Self>, packet: ClientboundPacket) {
        match packet {
            protocol::ClientboundPacket::Init {
                your_id,
                version: _,
            } => {
                *self.my_id.write().await = Some(your_id);
            }
            protocol::ClientboundPacket::ClientJoin { id } => {
                if id == self.my_id().await {
                    // we joined - YAY!
                } else {
                    self.peers.write().await.insert(
                        id,
                        self.sup
                            .add_peer(Peer::create(self.clone(), self.relay_tx.clone(), id).await)
                            .await,
                    );
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
            peer.peer().on_relay(p).await
        } else {
            warn!("got a packet from a non-existent peer")
        }
    }

    pub async fn send_relay(&self, recipient: usize, inner: RelayMessage) {
        self.sender
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
            .unwrap()
    }
}
