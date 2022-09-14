#![feature(async_closure)]
#![feature(box_syntax)]

use clap::{Parser, Subcommand};
use log::{debug, error};
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

fn main() {
    env_logger::init_from_env("LOG");
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
}

#[derive(Parser)]
pub struct Args {
    #[clap(long, default_value = "meet.metamuffin.org")]
    signaling_host: String,
    #[clap(short, long)]
    secret: String,
    #[clap(subcommand)]
    action: Action,
}
#[derive(Subcommand)]
pub enum Action {
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

    tokio::signal::ctrl_c().await.unwrap();
    error!("interrupt received, exiting");
}
