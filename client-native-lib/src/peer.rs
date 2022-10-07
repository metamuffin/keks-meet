/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
use crate::{
    protocol::{self, ProvideInfo, RelayMessage, Sdp},
    state::State,
};
use log::info;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use webrtc::{
    ice_transport::{
        ice_candidate::{RTCIceCandidate, RTCIceCandidateInit},
        ice_server::RTCIceServer,
    },
    peer_connection::{
        configuration::RTCConfiguration, peer_connection_state::RTCPeerConnectionState,
        sdp::session_description::RTCSessionDescription, RTCPeerConnection,
    },
};

pub struct Peer {
    pub state: Arc<State>,
    pub peer_connection: RTCPeerConnection,
    pub resources_provided: RwLock<HashMap<String, ProvideInfo>>,
    pub id: usize,
}

impl Peer {
    pub async fn create(state: Arc<State>, id: usize) -> Arc<Self> {
        info!("({id}) peer joined");
        let config = RTCConfiguration {
            ice_servers: vec![RTCIceServer {
                urls: vec!["stun:metamuffin.org:16900".to_owned()],
                ..Default::default()
            }],
            ..Default::default()
        };

        let peer_connection = state.api.new_peer_connection(config).await.unwrap();
        let peer = Arc::new(Self {
            resources_provided: Default::default(),
            state: state.clone(),
            peer_connection,
            id,
        });
        peer.peer_connection
            .on_peer_connection_state_change(Box::new(move |s: RTCPeerConnectionState| {
                info!("connection state changed: {s}");
                Box::pin(async {})
            }))
            .await;

        {
            let weak = Arc::<Peer>::downgrade(&peer);
            peer.peer_connection
                .on_ice_candidate(box move |c| {
                    let peer = weak.upgrade().unwrap();
                    Box::pin(async move {
                        if let Some(c) = c {
                            peer.on_ice_candidate(c).await
                        }
                    })
                })
                .await;
        }

        {
            let weak = Arc::<Peer>::downgrade(&peer);
            peer.peer_connection
                .on_negotiation_needed(box move || {
                    let peer = weak.upgrade().unwrap();
                    Box::pin(async { peer.on_negotiation_needed().await })
                })
                .await;
        }

        {
            peer.peer_connection
                .on_data_channel(box move |dc| {
                    Box::pin(async move {
                        dc.on_message(box move |message| {
                            Box::pin(async move { println!("{:?}", message.data) })
                        })
                        .await
                    })
                })
                .await;
        }
        peer
    }

    pub async fn send_relay(&self, inner: RelayMessage) {
        self.state.send_relay(self.id, inner).await
    }

    pub async fn on_relay(&self, p: RelayMessage) {
        match p {
            RelayMessage::Offer(o) => self.on_offer(o).await,
            RelayMessage::Answer(a) => self.on_answer(a).await,
            RelayMessage::IceCandidate(c) => self.on_remote_ice_candidate(c).await,
            RelayMessage::Provide(info) => {
                info!(
                    "remote resource provided: ({:?}) {:?} {:?}",
                    info.id, info.kind, info.label
                );
                self.resources_provided
                    .write()
                    .await
                    .insert(info.id.clone(), info.clone());
                self.state
                    .event_handler
                    .remote_resource_added(&self, info)
                    .await;
            }
            RelayMessage::ProvideStop { id } => {
                info!("remote resource removed: ({:?}) ", id);
                self.resources_provided.write().await.remove(&id);
                self.state
                    .event_handler
                    .remote_resource_removed(&self, id)
                    .await;
            }
            _ => (),
        }
    }

    pub async fn on_leave(&self) {
        info!("({}) peer left", self.id);
    }

    pub async fn on_ice_candidate(&self, candidate: RTCIceCandidate) {
        info!("publishing local ICE candidate");
        self.send_relay(RelayMessage::IceCandidate(
            candidate.to_json().await.unwrap(),
        ))
        .await;
    }
    pub async fn on_remote_ice_candidate(&self, candidate: RTCIceCandidateInit) {
        info!("adding remote ICE candidate");
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
