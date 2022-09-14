#![feature(async_closure)]
#![feature(box_syntax)]

use log::debug;
use signaling::signaling_connect;
use state::State;
use std::sync::Arc;
use tokio::sync::RwLock;
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

pub struct Config {
    pub signaling_host: String,
    pub secret: String,
}

pub async fn connect(config: Config) -> Arc<State> {
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

    let state = Arc::new(State {
        peers: Default::default(),
        key,
        api,
        my_id: RwLock::new(None),
        sender,
        config,
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
    state
}
