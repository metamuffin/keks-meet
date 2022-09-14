use log::info;
use std::sync::Arc;
use webrtc::{
    data_channel::data_channel_message::DataChannelMessage,
    ice_transport::{ice_candidate::RTCIceCandidate, ice_server::RTCIceServer},
    peer_connection::{
        configuration::RTCConfiguration, peer_connection_state::RTCPeerConnectionState,
        sdp::session_description::RTCSessionDescription, RTCPeerConnection,
    },
};

use crate::{
    protocol::{self, RTCSessionDescriptionInit, RelayMessage},
    state::State,
    Action,
};

pub struct Peer {
    state: Arc<State>, // maybe use Weak later
    peer_connection: RTCPeerConnection,
    id: usize,
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
            peer_connection,
            id,
            state: state.clone(),
        });
        peer.peer_connection
            .on_peer_connection_state_change(Box::new(move |s: RTCPeerConnectionState| {
                println!("conn state: {s}");
                Box::pin(async {})
            }))
            .await;

        {
            let peer2 = peer.clone();
            peer.peer_connection
                .on_ice_candidate(box move |c| {
                    let peer = peer2.clone();
                    Box::pin(async move {
                        if let Some(c) = c {
                            peer.on_ice_candidate(c).await
                        }
                    })
                })
                .await;
        }

        {
            let peer2 = peer.clone();
            peer.peer_connection
                .on_negotiation_needed(box move || {
                    let peer = peer2.clone();
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

        if let Action::Send { .. } = &peer.state.args.action {
            peer.start_transfer().await
        }

        peer
    }

    pub async fn send_relay(&self, inner: RelayMessage) {
        self.state.send_relay(self.id, inner).await
    }

    pub async fn start_transfer(&self) {
        info!("starting data channel");
        let data_channel = self
            .peer_connection
            .create_data_channel("file-transfer", None)
            .await
            .unwrap();

        data_channel
            .on_message(Box::new(move |msg: DataChannelMessage| {
                let msg_str = String::from_utf8(msg.data.to_vec()).unwrap();
                println!("message! '{}'", msg_str);
                Box::pin(async {})
            }))
            .await;

        {
            let dc2 = data_channel.clone();
            data_channel
                .on_open(box move || {
                    let data_channel = dc2.clone();
                    Box::pin(async move {
                        loop {
                            data_channel
                                .send(&bytes::Bytes::from_static(b"test\n"))
                                .await
                                .unwrap();
                        }
                    })
                })
                .await;
        }
    }

    pub async fn on_relay(&self, p: RelayMessage) {
        match p {
            protocol::RelayMessage::Offer(o) => self.on_offer(o).await,
            protocol::RelayMessage::Answer(a) => self.on_answer(a).await,
            protocol::RelayMessage::IceCandidate(c) => {
                info!("received ICE candidate");
                self.peer_connection.add_ice_candidate(c).await.unwrap();
            }
        }
    }

    pub async fn on_ice_candidate(&self, candidate: RTCIceCandidate) {
        self.send_relay(RelayMessage::IceCandidate(
            candidate.to_json().await.unwrap(),
        ))
        .await;
    }

    pub async fn on_negotiation_needed(self: Arc<Self>) {
        info!("({}) negotiation needed", self.id);
        self.offer().await
    }

    pub async fn offer(&self) {
        info!("sending offer");
        let offer = self.peer_connection.create_offer(None).await.unwrap();
        self.peer_connection
            .set_local_description(offer.clone())
            .await
            .unwrap();
        self.send_relay(protocol::RelayMessage::Offer(RTCSessionDescriptionInit {
            sdp: offer.sdp,
            ty: offer.sdp_type,
        }))
        .await
    }
    pub async fn on_offer(&self, offer: RTCSessionDescriptionInit) {
        info!("received offer");
        let offer = RTCSessionDescription::offer(offer.sdp).unwrap();
        self.peer_connection
            .set_remote_description(offer)
            .await
            .unwrap();
        self.answer().await
    }
    pub async fn answer(&self) {
        info!("sending answer");
        let offer = self.peer_connection.create_answer(None).await.unwrap();
        self.peer_connection
            .set_local_description(offer.clone())
            .await
            .unwrap();
        self.send_relay(protocol::RelayMessage::Answer(RTCSessionDescriptionInit {
            sdp: offer.sdp,
            ty: offer.sdp_type,
        }))
        .await
    }
    pub async fn on_answer(&self, answer: RTCSessionDescriptionInit) {
        info!("received answer");
        let offer = RTCSessionDescription::answer(answer.sdp).unwrap();
        self.peer_connection
            .set_remote_description(offer)
            .await
            .unwrap();
    }
}
