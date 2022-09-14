#![feature(async_closure)]
#![feature(box_syntax)]

use log::debug;
use signaling::signaling_connect;
use state::{HasPeer, PeerInit, State};
use std::{marker::Sync, sync::Arc};
use tokio::sync::{mpsc::unbounded_channel, RwLock};
use webrtc::{
    api::{
        interceptor_registry::register_default_interceptors, media_engine::MediaEngine, APIBuilder,
    },
    interceptor::registry::Registry,
};

pub mod crypto;
pub mod peer;
pub mod protocol;
pub mod signaling;
pub mod state;

pub use webrtc;

pub struct Config {
    pub signaling_host: String,
    pub secret: String,
}

pub async fn connect<I, P>(config: Config, sup: Arc<I>) -> Arc<State<P, I>>
where
    I: PeerInit<P> + Sync + std::marker::Send + 'static,
    P: HasPeer + Sync + std::marker::Send + 'static,
{
    let (sender, mut recv) = signaling_connect(&config.signaling_host, &config.secret).await;

    let key = crypto::Key::derive(&config.secret);

    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs().unwrap();
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut media_engine).unwrap();
    let api = APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build();

    let (relay_tx, mut relay_rx) = unbounded_channel();
    let state = Arc::new(State {
        peers: Default::default(),
        key,
        api,
        my_id: RwLock::new(None),
        sender,
        config,
        relay_tx,
        sup,
    });

    {
        let state = state.clone();
        tokio::spawn(async move {
            debug!("receiving packets now");
            while let Some((r, p)) = relay_rx.recv().await {
                let state = state.clone();
                state.send_relay(r, p).await
            }
        });
    }
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
    state
}
