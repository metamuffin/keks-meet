/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
#![feature(async_closure)]
#![feature(box_syntax)]
#![feature(async_fn_in_trait)]

use log::debug;
use protocol::ProvideInfo;
use signaling::signaling_connect;
use state::State;
use std::sync::Arc;
use tokio::sync::{mpsc::unbounded_channel, RwLock};
use webrtc::{
    api::{
        interceptor_registry::register_default_interceptors, media_engine::MediaEngine, APIBuilder,
    },
    data_channel::RTCDataChannel,
    interceptor::registry::Registry,
    track::{track_local::TrackLocal, track_remote::TrackRemote},
};

pub mod crypto;
pub mod peer;
pub mod protocol;
pub mod signaling;
pub mod state;

pub use webrtc;

pub struct Config {
    pub signaling_uri: String,
    pub secret: String,
}

pub async fn connect(config: Config) -> Arc<State> {
    let (sender, mut recv) = signaling_connect(&config.signaling_uri, &config.secret).await;

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
