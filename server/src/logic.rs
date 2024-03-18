/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use crate::{
    idgen::IdGenerator,
    protocol::{ClientboundPacket, ServerboundPacket},
};
use futures_util::{stream::SplitStream, StreamExt};
use log::{debug, error, warn};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, LazyLock},
};
use tokio::sync::{mpsc::Sender, RwLock};
use warp::ws::WebSocket;

#[allow(clippy::redundant_closure)]
static CLIENTS: LazyLock<RwLock<HashMap<Client, Sender<ClientboundPacket>>>> =
    LazyLock::new(|| Default::default());

#[repr(transparent)]
#[derive(Debug, Hash, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Client(u64);

#[derive(Default)]
pub struct State {
    idgen: IdGenerator,
    rooms: RwLock<HashMap<String, Arc<Room>>>,
    watches: RwLock<HashMap<String, HashSet<Client>>>,
}

#[derive(Debug)]
pub struct Room {
    pub hash: String,
    pub users: RwLock<HashSet<Client>>,
}

#[derive(Debug, Default)]
pub struct ClientState {
    current_room: Option<Arc<Room>>,
    watches: Vec<String>,
}

impl State {
    pub async fn connect(&self, rx: SplitStream<WebSocket>, tx: Sender<ClientboundPacket>) {
        debug!("new client connected");
        let client = Client(self.idgen.generate().await);
        CLIENTS.write().await.insert(client, tx);
        self.connect_inner(client, rx).await;
        CLIENTS.write().await.remove(&client);
    }
    async fn connect_inner(&self, client: Client, mut rx: SplitStream<WebSocket>) {
        let mut cstate = ClientState::default();
        client
            .send(ClientboundPacket::Init {
                your_id: client,
                version: format!("keks-meet {}", env!("CARGO_PKG_VERSION")),
            })
            .await;

        while let Some(result) = rx.next().await {
            let msg = match result {
                Ok(msg) => msg,
                Err(e) => {
                    error!("websocket error: {e}");
                    break;
                }
            };
            if let Ok(s) = msg.to_str() {
                let packet = match serde_json::from_str::<ServerboundPacket>(s) {
                    Ok(p) => p,
                    Err(e) => {
                        error!("client sent invalid packet: {e:?}");
                        break;
                    }
                };
                debug!("<-  {packet:?}");
                self.on_recv(client, &mut cstate, packet).await;
            }
        }

        if let Some(room) = cstate.current_room {
            room.leave(self, client).await;
            // TODO dont leak room
        }
        {
            let mut w = self.watches.write().await;
            for e in cstate.watches {
                let mut remove = false;
                if let Some(e) = w.get_mut(&e) {
                    e.remove(&client);
                    remove = e.is_empty()
                }
                if remove {
                    w.remove(&e);
                }
            }
        }
    }

    async fn on_recv(&self, client: Client, cstate: &mut ClientState, packet: ServerboundPacket) {
        match packet {
            ServerboundPacket::Ping => (),
            ServerboundPacket::Join { hash } => {
                if let Some(room) = &cstate.current_room {
                    room.leave(self, client).await;
                    if room.should_remove().await {
                        self.rooms.write().await.remove(&room.hash);
                    }
                }
                if let Some(hash) = hash {
                    let room = self
                        .rooms
                        .write()
                        .await
                        .entry(hash.clone())
                        .or_insert_with(|| Room::new(&hash).into())
                        .clone();
                    room.join(self, client).await;
                    cstate.current_room = Some(room.clone())
                } else {
                    cstate.current_room = None
                }
            }
            ServerboundPacket::Relay { recipient, message } => {
                if let Some(room) = &cstate.current_room {
                    let packet = ClientboundPacket::Message {
                        sender: client,
                        message,
                    };
                    if let Some(recipient) = recipient {
                        room.send_to_client(recipient, packet).await;
                    } else {
                        room.broadcast(Some(client), packet).await;
                    }
                }
            }
            ServerboundPacket::WatchRooms(mut list) => {
                let mut w = self.watches.write().await;
                let r = self.rooms.read().await;

                for e in list.iter().cloned() {
                    w.entry(e.to_string()).or_default().insert(client);
                    if let Some(r) = r.get(&e) {
                        client
                            .send(ClientboundPacket::RoomInfo {
                                hash: e,
                                user_count: r.users.read().await.len(),
                            })
                            .await;
                    }
                }
                std::mem::swap(&mut cstate.watches, &mut list);
                for e in list {
                    let mut remove = false;
                    if let Some(e) = w.get_mut(&e) {
                        e.remove(&client);
                        remove = e.is_empty()
                    }
                    if remove {
                        w.remove(&e);
                    }
                }
            }
        }
    }
}

impl Client {
    pub async fn send(&self, packet: ClientboundPacket) {
        if let Some(s) = CLIENTS.read().await.get(self) {
            s.send(packet).await.unwrap();
        } else {
            warn!("invalid recipient {self:?}")
        }
    }
}

impl Room {
    pub fn new(hash: &String) -> Self {
        Self {
            hash: hash.to_owned(),
            users: Default::default(),
        }
    }
    pub async fn join(&self, state: &State, client: Client) {
        debug!("client join {client:?}");

        let user_count = {
            let mut g = self.users.write().await;
            g.insert(client);
            g.len()
        };
        for w in state
            .watches
            .read()
            .await
            .get(&self.hash)
            .into_iter()
            .flatten()
        {
            w.send(ClientboundPacket::RoomInfo {
                hash: self.hash.to_owned(),
                user_count,
            })
            .await;
        }
        // send join of this client to all clients
        self.broadcast(None, ClientboundPacket::ClientJoin { id: client })
            .await;
        // send join of all other clients to this one
        for rc in self.users.read().await.iter() {
            if *rc != client {
                self.send_to_client(client, ClientboundPacket::ClientJoin { id: *rc })
                    .await;
            }
        }
    }

    pub async fn leave(&self, state: &State, client: Client) {
        debug!("client leave {client:?}");
        for c in self.users.read().await.iter() {
            self.send_to_client(*c, ClientboundPacket::ClientLeave { id: client })
                .await;
        }
        let user_count = {
            let mut g = self.users.write().await;
            g.remove(&client);
            g.len()
        };
        for w in state
            .watches
            .read()
            .await
            .get(&self.hash)
            .into_iter()
            .flatten()
        {
            w.send(ClientboundPacket::RoomInfo {
                hash: self.hash.to_owned(),
                user_count,
            })
            .await;
        }
        self.broadcast(Some(client), ClientboundPacket::ClientLeave { id: client })
            .await;
    }

    pub async fn broadcast(&self, sender: Option<Client>, packet: ClientboundPacket) {
        for c in self.users.read().await.iter() {
            if sender != Some(*c) {
                c.send(packet.clone()).await;
            }
        }
    }
    pub async fn send_to_client(&self, recipient: Client, packet: ClientboundPacket) {
        if let Some(c) = self.users.read().await.get(&recipient) {
            c.send(packet).await;
        }
    }

    pub async fn should_remove(&self) -> bool {
        self.users.read().await.len() == 0
    }
}
