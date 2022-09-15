use crate::{
    protocol::{self, RTCSessionDescriptionInit, RelayMessage},
    state::{HasPeer, PeerInit, State},
};
use log::info;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use webrtc::{
    ice_transport::{ice_candidate::RTCIceCandidate, ice_server::RTCIceServer},
    peer_connection::{
        configuration::RTCConfiguration, peer_connection_state::RTCPeerConnectionState,
        sdp::session_description::RTCSessionDescription, RTCPeerConnection,
    },
};

pub struct Peer {
    pub signal: UnboundedSender<(usize, RelayMessage)>,
    pub peer_connection: RTCPeerConnection,
    pub id: usize,
}

impl Peer {
    pub async fn create<P: HasPeer, I: PeerInit<P>>(
        state: Arc<State<P, I>>,
        signal: UnboundedSender<(usize, RelayMessage)>,
        id: usize,
    ) -> Arc<Self> {
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
            signal,
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
        self.signal.send((self.id, inner)).unwrap()
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
        info!("({}) sending offer", self.id);
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
        info!("({}) received offer", self.id);
        let offer = RTCSessionDescription::offer(offer.sdp).unwrap();
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
        self.send_relay(protocol::RelayMessage::Answer(RTCSessionDescriptionInit {
            sdp: offer.sdp,
            ty: offer.sdp_type,
        }))
        .await
    }
    pub async fn on_answer(&self, answer: RTCSessionDescriptionInit) {
        info!("({}) received answer", self.id);
        let offer = RTCSessionDescription::answer(answer.sdp).unwrap();
        self.peer_connection
            .set_remote_description(offer)
            .await
            .unwrap();
    }
}
