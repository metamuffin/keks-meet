/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use crate::{
    instance::Instance,
    protocol::{self, ProvideInfo, RelayMessage, Sdp},
};
use log::{debug, info, warn};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use webrtc::{
    data_channel::RTCDataChannel,
    ice_transport::{
        ice_candidate::{RTCIceCandidate, RTCIceCandidateInit},
        ice_server::RTCIceServer,
    },
    peer_connection::{
        configuration::RTCConfiguration, peer_connection_state::RTCPeerConnectionState,
        sdp::session_description::RTCSessionDescription, RTCPeerConnection,
    },
    track::track_remote::TrackRemote,
};

pub struct Peer {
    pub inst: Arc<Instance>,
    pub peer_connection: RTCPeerConnection,
    pub remote_provided: RwLock<HashMap<String, ProvideInfo>>,
    pub id: usize,
}

// pub struct RemoteResource {
//     info: ProvideInfo,
//     state: RemoteResourceInner,
// }
// // (Box<dyn FnOnce(Arc<TransportChannel>) -> Pin<Box<dyn Future<Output = ()>>>>)
// pub enum RemoteResourceInner {
//     Disconnected,
//     AwaitConnect,
//     Connected(Arc<TransportChannel>),
//     AwaitDisconnect,
// }

pub enum TransportChannel {
    Track(Arc<TrackRemote>),
    DataChannel(Arc<RTCDataChannel>),
}

impl Peer {
    pub async fn create(inst: Arc<Instance>, id: usize) -> Arc<Self> {
        info!("({id}) peer joined");
        let config = RTCConfiguration {
            ice_servers: vec![RTCIceServer {
                urls: vec!["stun:metamuffin.org:16900".to_owned()],
                ..Default::default()
            }],
            ..Default::default()
        };

        let peer_connection = inst.api.new_peer_connection(config).await.unwrap();
        let peer = Arc::new(Self {
            remote_provided: Default::default(),
            inst: inst.clone(),
            peer_connection,
            id,
        });
        peer.peer_connection
            .on_peer_connection_state_change(Box::new(move |s: RTCPeerConnectionState| {
                info!("connection state changed: {s}");
                Box::pin(async {})
            }));
        {
            let weak = Arc::<Peer>::downgrade(&peer);
            peer.peer_connection.on_ice_candidate(Box::new(move |c| {
                if let Some(peer) = weak.upgrade() {
                    Box::pin(async move {
                        if let Some(c) = c {
                            peer.on_ice_candidate(c).await
                        }
                    })
                } else {
                    Box::pin(async move {})
                }
            }))
        }

        {
            let weak = Arc::<Peer>::downgrade(&peer);
            peer.peer_connection
                .on_negotiation_needed(Box::new(move || {
                    let peer = weak.upgrade().unwrap();
                    Box::pin(async { peer.on_negotiation_needed().await })
                }))
        }

        {
            let weak = Arc::<Peer>::downgrade(&peer);
            peer.peer_connection
                .on_track(Box::new(move |track_remote, receiver, _transceiver| {
                    let peer = weak.upgrade().unwrap();
                    Box::pin(async move {
                        let id = &track_remote.stream_id();
                        if let Some(res) = peer.remote_provided.read().await.get(id) {
                            info!("track for ({:?}) '{:?}'", res.id, res.label);
                            peer.inst
                                .event_handler
                                .resource_connected(
                                    peer.clone(),
                                    res,
                                    TransportChannel::Track(track_remote),
                                )
                                .await;
                        } else {
                            warn!("got unassociated track; stopping receiver");
                            receiver.stop().await.unwrap();
                        }
                    })
                }))
        }

        {
            let weak = Arc::<Peer>::downgrade(&peer);
            peer.peer_connection.on_data_channel(Box::new(move |dc| {
                let peer = weak.upgrade().unwrap();
                Box::pin(async move {
                    if let Some(res) = peer
                        .remote_provided
                        .read()
                        .await
                        .get(&dc.label().to_string())
                    {
                        info!("data channel for ({:?}) '{:?}'", res.id, res.label);
                        peer.inst
                            .event_handler
                            .resource_connected(
                                peer.clone(),
                                res,
                                TransportChannel::DataChannel(dc),
                            )
                            .await;
                    } else {
                        warn!("got unassociated data channel; closed connection");
                        dc.close().await.unwrap();
                    }
                })
            }))
        }
        peer
    }

    pub async fn init_remote(&self) {
        self.send_relay(RelayMessage::Identify {
            username: self.inst.config.username.clone(),
        })
        .await;
        for res in self.inst.local_resources.read().await.values() {
            self.send_relay(RelayMessage::Provide(res.info())).await;
        }
    }

    pub async fn request_resource(&self, id: String) {
        self.send_relay(RelayMessage::Request { id }).await;
    }
    pub async fn request_stop_resource(&self, id: String) {
        self.send_relay(RelayMessage::RequestStop { id }).await;
    }

    pub async fn send_relay(&self, inner: RelayMessage) {
        self.inst.send_relay(Some(self.id), inner).await
    }

    pub async fn on_relay(self: &Arc<Self>, p: RelayMessage) {
        match p {
            RelayMessage::Offer(o) => self.on_offer(o).await,
            RelayMessage::Answer(a) => self.on_answer(a).await,
            RelayMessage::IceCandidate(c) => self.on_remote_ice_candidate(c).await,
            RelayMessage::Provide(info) => {
                info!(
                    "remote resource provided: ({:?}) {:?} {:?}",
                    info.id, info.kind, info.label
                );
                self.remote_provided
                    .write()
                    .await
                    .insert(info.id.clone(), info.clone());
                self.inst
                    .event_handler
                    .resource_added(self.clone(), info)
                    .await;
            }
            RelayMessage::ProvideStop { id } => {
                info!("remote resource removed: ({:?}) ", id);
                self.remote_provided.write().await.remove(&id);
                self.inst
                    .event_handler
                    .resource_removed(self.clone(), id)
                    .await;
            }
            RelayMessage::Chat(_) => (),
            RelayMessage::Identify { username } => {
                info!("peer {} is known as {username:?}", self.id)
            }
            RelayMessage::Request { id } => {
                if let Some(res) = self.inst.local_resources.read().await.get(&id) {
                    res.on_request(self.clone()).await;
                } else {
                    warn!("({}) requested unknown local resource", self.id)
                }
            }
            RelayMessage::RequestStop { id: _ } => {} // TODO
        }
    }

    pub async fn on_leave(&self) {
        info!("({}) peer left", self.id);
    }

    pub async fn on_ice_candidate(&self, candidate: RTCIceCandidate) {
        debug!("publishing local ICE candidate");
        self.send_relay(RelayMessage::IceCandidate(candidate.to_json().unwrap()))
            .await;
    }
    pub async fn on_remote_ice_candidate(&self, candidate: RTCIceCandidateInit) {
        debug!("adding remote ICE candidate");
        self.peer_connection
            .add_ice_candidate(candidate)
            .await
            .unwrap();
    }

    pub async fn on_negotiation_needed(self: Arc<Self>) {
        info!("({}) negotiation needed", self.id);
        self.offer().await
    }

    pub async fn offer(&self) {
        info!("({}) sending offer", self.id);
        let offer = self.peer_connection.create_offer(None).await.unwrap();
        self.peer_connection
            .set_local_description(offer.clone())
            .await
            .unwrap();
        self.send_relay(protocol::RelayMessage::Offer(offer.sdp))
            .await
    }
    pub async fn on_offer(&self, offer: Sdp) {
        info!("({}) received offer", self.id);
        let offer = RTCSessionDescription::offer(offer).unwrap();
        self.peer_connection
            .set_remote_description(offer)
            .await
            .unwrap();
        self.answer().await
    }
    pub async fn answer(&self) {
        info!("({}) sending answer", self.id);
        let offer = self.peer_connection.create_answer(None).await.unwrap();
        self.peer_connection
            .set_local_description(offer.clone())
            .await
            .unwrap();
        self.send_relay(protocol::RelayMessage::Answer(offer.sdp))
            .await
    }
    pub async fn on_answer(&self, answer: Sdp) {
        info!("({}) received answer", self.id);
        let offer = RTCSessionDescription::answer(answer).unwrap();
        self.peer_connection
            .set_remote_description(offer)
            .await
            .unwrap();
    }
}
