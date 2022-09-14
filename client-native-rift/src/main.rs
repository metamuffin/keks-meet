#![feature(async_closure)]
#![feature(box_syntax)]

use crate::protocol::{RTCSessionDescriptionInit, RelayMessageWrapper, ServerboundPacket};
use clap::{Parser, Subcommand};
use crypto::Key;
use futures_util::{SinkExt, StreamExt};
use log::{debug, info};
use protocol::{ClientboundPacket, RelayMessage};
use signaling::signaling_connect;
use std::{
    collections::HashMap,
    sync::{Arc, Weak},
    time::Duration,
};
use tokio::sync::{mpsc::UnboundedSender, Mutex, RwLock};
use webrtc::{
    api::{
        interceptor_registry::register_default_interceptors, media_engine::MediaEngine, APIBuilder,
        API,
    },
    data_channel::data_channel_message::DataChannelMessage,
    ice_transport::ice_server::RTCIceServer,
    interceptor::registry::Registry,
    peer_connection::{
        configuration::RTCConfiguration, peer_connection_state::RTCPeerConnectionState,
        RTCPeerConnection,
    },
};

pub mod crypto;
pub mod protocol;
pub mod signaling;

fn main() {
    env_logger::init_from_env("LOG");
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
}

#[derive(Parser)]
struct Args {
    #[clap(long, default_value = "meet.metamuffin.org")]
    signaling_host: String,
    #[clap(short, long)]
    secret: String,
    #[clap(subcommand)]
    action: Action,
}
#[derive(Subcommand)]
enum Action {
    Send {},
    Receive {},
}

async fn run() {
    let args = Args::parse();
    let (sender, mut recv) = signaling_connect(&args.signaling_host, &args.secret).await;

    let key = crypto::Key::derive(&args.secret);

    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs().unwrap();
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut media_engine).unwrap();
    let api = APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build();

    let state = Arc::new(State {
        peers: Default::default(),
        key,
        api,
        my_id: RwLock::new(None),
        sender,
        args,
    });

    {
        let state = state.clone();
        tokio::spawn(async move {
            debug!("receiving packets now");
            while let Some(packet) = recv.recv().await {
                debug!("{packet:?}");
                let state = state.clone();
                state.on_message(packet).await
            }
        });
    }

    tokio::time::sleep(Duration::from_secs(10000)).await;

    // // Wait for the answer to be pasted
    // let line = signal::must_read_stdin().unwrap();
    // let desc_data = signal::decode(line.as_str()).unwrap();
    // let answer = serde_json::from_str::<RTCSessionDescription>(&desc_data)?;

    // // Apply the answer as the remote description
    // peer_connection.set_remote_description(answer).await?;
}

pub struct State {
    args: Args,
    api: API,
    key: Key,
    my_id: RwLock<Option<usize>>,
    sender: UnboundedSender<ServerboundPacket>,
    peers: RwLock<HashMap<usize, Arc<Peer>>>,
}
impl State {
    pub async fn my_id(&self) -> usize {
        self.my_id.read().await.expect("not initialized yet")
    }

    pub async fn on_message(&self, packet: ClientboundPacket) {
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
                    if let Action::Send { .. } = &self.args.action {}
                }
            }
            protocol::ClientboundPacket::ClientLeave { id: _ } => {}
            protocol::ClientboundPacket::Message { sender, message } => {
                let message = self.key.decrypt(&message);
                let p = serde_json::from_str::<RelayMessageWrapper>(&message).unwrap();
                self.on_relay(sender, p.inner).await;
            }
        }
    }

    pub async fn on_relay(&self, sender: usize, p: RelayMessage) {}

    pub async fn send_relay(&self, receipient: usize, inner: RelayMessage) {
        self.sender
            .send(ServerboundPacket::Relay {
                recipient: Some(0),
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

pub struct Peer {
    state: Arc<State>, // maybe use Weak later
    peer_connection: RTCPeerConnection,
    id: usize,
}

impl Peer {
    pub async fn create(state: Arc<State>, id: usize) -> Arc<Self> {
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
                .on_negotiation_needed(box move || {
                    let peer = peer2.clone();
                    Box::pin(async { peer.on_negotiation_needed().await })
                })
                .await;
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
    }

    pub async fn on_relay(&self, p: RelayMessage) {
        match p {
            protocol::RelayMessage::Offer(o) => todo!(),
            protocol::RelayMessage::Answer(a) => todo!(),
            protocol::RelayMessage::IceCandidate(c) => {
                self.peer_connection.add_ice_candidate(c).await.unwrap();
            }
        }
    }

    pub async fn on_negotiation_needed(self: Arc<Self>) {
        info!("({}) negotiation needed", self.id);
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
}
