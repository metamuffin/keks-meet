/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
#![feature(async_closure)]
// #![feature(async_fn_in_trait)]

use futures_util::Future;
use peer::{Peer, TransportChannel};
use protocol::{ProvideInfo, RelayMessage};
use std::{pin::Pin, sync::Arc};
use webrtc::{
    api::{
        interceptor_registry::register_default_interceptors, media_engine::MediaEngine, APIBuilder,
    },
    interceptor::registry::Registry,
};

pub mod crypto;
pub mod instance;
pub mod peer;
pub mod protocol;
pub mod signaling;

pub use webrtc;

pub struct Config {
    pub signaling_uri: String,
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

pub type DynFut<T> = Pin<Box<dyn Future<Output = T> + Send>>;
pub trait LocalResource: Send + Sync + 'static {
    fn info(&self) -> ProvideInfo;
    fn on_request(&self, peer: Arc<Peer>) -> DynFut<()>;
}

#[allow(unused_variables)]
pub trait EventHandler: Send + Sync + 'static {
    fn peer_join(&self, peer: Arc<Peer>) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn peer_leave(&self, peer: Arc<Peer>) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_added(&self, peer: Arc<Peer>, info: ProvideInfo) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_removed(&self, peer: Arc<Peer>, id: String) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_connected(
        &self,
        peer: Arc<Peer>,
        resource: &ProvideInfo,
        channel: TransportChannel,
    ) -> DynFut<()>;
    fn on_relay(&self, peer: Arc<Peer>, message: &RelayMessage) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn room_info(&self, hash: String, user_count: usize) -> DynFut<()> {
        Box::pin(async move {})
    }
}
