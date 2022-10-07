/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
#![feature(async_closure)]
#![feature(box_syntax)]
#![feature(async_fn_in_trait)]

use state::State;
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

pub use webrtc;

pub struct Config {
    pub signaling_uri: String,
    pub secret: String,
}

impl State {
    pub async fn new(config: Config) -> Self {
        let conn = signaling::SignalingConnection::new(&config.signaling_uri, &config.secret).await;
        let key = crypto::Key::derive(&config.secret);

        Self {
            api: build_api(),
            my_id: RwLock::new(None),
            peers: Default::default(),
            config,
            conn,
            key,
        }
    }
}

fn build_api() -> webrtc::api::API {
    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs().unwrap();
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut media_engine).unwrap();
    APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build()
}
