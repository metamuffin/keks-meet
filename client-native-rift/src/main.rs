/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
#![allow(clippy::type_complexity)]
pub mod command;
pub mod file;
pub mod port;
pub mod repl;

use crate::command::dispatch_command;
use clap::{ColorChoice, Parser};
use libkeks::{
    instance::Instance,
    peer::{Peer, TransportChannel},
    protocol::{ChatMesssage, ProvideInfo, RelayMessage},
    webrtc::data_channel::RTCDataChannel,
    Config, DynFut, EventHandler,
};
use log::{error, info, trace, warn};
use repl::repl;
use std::{
    collections::HashMap, future::Future, path::PathBuf, pin::Pin, process::exit, sync::Arc,
};
use tokio::sync::RwLock;
use users::get_current_username;

fn main() {
    pretty_env_logger::formatted_builder()
        .filter_module("rift", log::LevelFilter::Info)
        .filter_module("libkeks", log::LevelFilter::Info)
        .filter_module("chat", log::LevelFilter::Trace)
        .parse_env("LOG")
        .init();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
        .unwrap();
}

/// If no command is provided, rift will enter REPL-mode.
#[derive(Parser, Clone)]
#[clap(multicall = false, color = ColorChoice::Auto)]
pub struct Args {
    /// keks-meet server used for establishing p2p connection
    #[clap(long, default_value = "wss://meet.metamuffin.org")]
    signaling_uri: String,
    /// username override
    #[clap(short, long, default_value_t = get_username())]
    username: String,
    /// pre-shared secret (aka. room name)
    secret: String,
    // /// Dispatch a single command after startup
    #[clap(subcommand)]
    command: Option<Command>,
}

#[derive(Parser, Debug, Clone)]
#[clap(multicall = true, color = ColorChoice::Always)]
pub enum Command {
    /// List all peers and their services.
    List,
    /// Stop providing a services by ID.
    Stop {
        // IDs of the services to stop. If ommited, all services are stopped.
        ids: Vec<String>,
    },
    /// Provide a file for download to other peers
    Provide { path: PathBuf, id: Option<String> },
    /// Download another peer's files.
    Download { id: String, path: Option<PathBuf> },
    /// Expose a local TCP port to other peers.
    Expose { port: u16, id: Option<String> },
    /// Forward TCP connections to local port to another peer.
    Forward { id: String, port: Option<u16> },
    /// Send a message in the room chat.
    Chat { message: String },
}

struct State {
    requested: HashMap<String, Box<dyn RequestHandler>>,
}
pub trait RequestHandler: Send + Sync + 'static {
    fn on_connect(
        &self,
        resource: ProvideInfo,
        channel: Arc<RTCDataChannel>,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + Sync>>;
}

#[derive(Clone)]
struct Handler {
    state: Arc<RwLock<State>>,
}

fn get_username() -> String {
    get_current_username()
        .map(|u| u.to_str().unwrap().to_string())
        .unwrap_or("guest".to_string())
        .to_owned()
}

async fn run() -> anyhow::Result<()> {
    let args = Args::parse();
    let state = Arc::new(RwLock::new(State {
        requested: Default::default(),
    }));
    let inst = Instance::new(
        Config {
            signaling_uri: args.signaling_uri.clone(),
            username: args.username.clone(),
        },
        Arc::new(Handler {
            state: state.clone(),
        }),
    )
    .await;

    inst.join(Some(&args.secret)).await;

    inst.spawn_ping().await;
    tokio::task::spawn(inst.clone().receive_loop());

    if let Some(command) = args.command {
        info!("running startup command...");
        if let Err(e) = dispatch_command(&inst, &state, command).await {
            error!("{e}");
            exit(1);
        };
        info!("done");
    }
    tokio::task::spawn_blocking(move || repl(inst, state))
        .await?
        .await?;

    Ok(())
}

impl EventHandler for Handler {
    fn peer_join(&self, _peer: Arc<Peer>) -> libkeks::DynFut<()> {
        Box::pin(async move {})
    }
    fn peer_leave(&self, _peer: Arc<Peer>) -> libkeks::DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_added(
        &self,
        _peer: Arc<Peer>,
        _info: libkeks::protocol::ProvideInfo,
    ) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_removed(&self, _peer: Arc<Peer>, _id: String) -> DynFut<()> {
        Box::pin(async move {})
    }
    fn on_relay(&self, peer: Arc<Peer>, message: &RelayMessage) -> DynFut<()> {
        let message = message.to_owned();
        Box::pin(async move {
            match message {
                RelayMessage::Chat(ChatMesssage::Text(message)) => {
                    let username = peer
                        .username
                        .read()
                        .await
                        .clone()
                        .unwrap_or("<unknown>".to_string());
                    let path = format!("chat::{username}");
                    trace!(target: &path, "{message}");
                }
                _ => (),
            }
        })
    }
    fn resource_connected(
        &self,
        _peer: Arc<Peer>,
        resource: &ProvideInfo,
        channel: TransportChannel,
    ) -> libkeks::DynFut<()> {
        let resource = resource.clone();
        let k = self.clone();
        Box::pin(async move {
            if let Some(handler) = k.state.write().await.requested.get(&resource.id) {
                match channel {
                    TransportChannel::Track(_) => warn!("wrong type"),
                    TransportChannel::DataChannel(channel) => {
                        if let Err(e) = handler.on_connect(resource, channel).await {
                            warn!("request handler error: {e}");
                        }
                    }
                }
            } else {
                warn!("got {:?}, which was not requested", resource.id);
            }
        })
    }
}
