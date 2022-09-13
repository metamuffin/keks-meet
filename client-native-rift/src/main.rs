#![feature(async_closure)]

use std::{sync::Arc, time::Duration};

use signaling::signaling_connect;
use webrtc::{
    api::{
        interceptor_registry::register_default_interceptors, media_engine::MediaEngine, APIBuilder,
    },
    data_channel::data_channel_message::DataChannelMessage,
    ice_transport::ice_server::RTCIceServer,
    interceptor::registry::Registry,
    peer_connection::{
        configuration::RTCConfiguration, math_rand_alpha,
        peer_connection_state::RTCPeerConnectionState,
    },
};

pub mod crypto;
pub mod protocol;
pub mod signaling;

fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
}

async fn run() {
    let (send, recv) = signaling_connect("meet.metamuffin.org", "hunter2").await;

    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs().unwrap();
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut media_engine).unwrap();
    let api = APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build();

    let config = RTCConfiguration {
        ice_servers: vec![RTCIceServer {
            urls: vec!["stun:metamuffin.org:16900".to_owned()],
            ..Default::default()
        }],
        ..Default::default()
    };

    let peer_connection = Arc::new(api.new_peer_connection(config).await.unwrap());

    let data_channel = peer_connection
        .create_data_channel("data", None)
        .await
        .unwrap();

    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(1);

    peer_connection
        .on_peer_connection_state_change(Box::new(move |s: RTCPeerConnectionState| {
            println!("conn state: {s}");
            Box::pin(async {})
        }))
        .await;

    let d_label = data_channel.label().to_owned();
    data_channel
        .on_message(Box::new(move |msg: DataChannelMessage| {
            let msg_str = String::from_utf8(msg.data.to_vec()).unwrap();
            println!("Message from DataChannel '{}': '{}'", d_label, msg_str);
            Box::pin(async {})
        }))
        .await;

    let offer = peer_connection.create_offer(None).await.unwrap();
    peer_connection
        .set_local_description(offer.clone())
        .await
        .unwrap();

    println!("{offer:?}");

    tokio::time::sleep(Duration::from_secs(5)).await;

    // // Wait for the answer to be pasted
    // let line = signal::must_read_stdin().unwrap();
    // let desc_data = signal::decode(line.as_str()).unwrap();
    // let answer = serde_json::from_str::<RTCSessionDescription>(&desc_data)?;

    // // Apply the answer as the remote description
    // peer_connection.set_remote_description(answer).await?;
}
