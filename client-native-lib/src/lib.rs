/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
#![feature(async_closure)]
#![feature(box_syntax)]
#![feature(async_fn_in_trait)]

use std::{pin::Pin, sync::Arc};

use futures_util::Future;
use peer::Peer;
use protocol::ProvideInfo;
use instance::Instance;
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
pub mod instance;

pub use webrtc;

pub struct Config {
    pub signaling_uri: String,
    pub secret: String,
    pub username: String,
}

pub(crate) fn build_api() -> webrtc::api::API {
    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs().unwrap();
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut media_engine).unwrap();
    APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build()
}

pub trait LocalResource: Send + Sync + 'static {
    fn info(&self) -> ProvideInfo;
    fn on_request(&self, peer: Arc<Peer>) -> Box<dyn Future<Output = ()>>;
}

pub trait EventHandler: Send + Sync + 'static {
    fn remote_resource_added(
        &self,
        peer: Arc<Peer>,
        info: ProvideInfo,
    ) -> Pin<Box<dyn Future<Output = ()>>>;
    fn remote_resource_removed(&self, peer: Arc<Peer>, id: String)
        -> Pin<Box<dyn Future<Output = ()>>>;
}
