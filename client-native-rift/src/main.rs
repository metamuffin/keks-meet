/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/

pub mod file;
pub mod port;

use clap::{ColorChoice, Parser};
use file::{DownloadHandler, FileSender};
use libkeks::{
    instance::Instance,
    peer::{Peer, TransportChannel},
    protocol::ProvideInfo,
    webrtc::data_channel::RTCDataChannel,
    Config, DynFut, EventHandler,
};
use log::{error, info, warn};
use port::{ForwardHandler, PortExposer};
use rustyline::{error::ReadlineError, DefaultEditor};
use std::{
    collections::HashMap, future::Future, os::unix::prelude::MetadataExt, path::PathBuf, pin::Pin,
    sync::Arc,
};
use tokio::{fs, net::TcpListener, sync::RwLock};
use users::get_current_username;

fn main() {
    pretty_env_logger::formatted_builder()
        .filter_module("rift", log::LevelFilter::Info)
        .filter_module("libkeks", log::LevelFilter::Info)
        .parse_env("LOG")
        .init();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
        .unwrap();
}

#[derive(Parser, Clone)]
/// If no command is provided, rift will enter REPL-mode.
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
    // #[clap(subcommand)]
    // command: Option<Command>,
}

#[derive(Parser, Debug, Clone)]
#[clap(multicall = true, color = ColorChoice::Always)]
pub enum Command {
    /// List all peers and their services.
    List,
    /// Provide a file for download to other peers
    Provide { path: PathBuf, id: Option<String> },
    /// Download another peer's files.
    Download { id: String, path: Option<PathBuf> },
    /// Expose a local TCP port to other peers.
    Expose { port: u16, id: Option<String> },
    /// Forward TCP connections to local port to another peer.
    Forward { id: String, port: Option<u16> },
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

    let mut rl = DefaultEditor::new()?;
    loop {
        match rl.readline("> ") {
            Ok(line) => match Command::try_parse_from(shlex::split(&line).unwrap()) {
                Ok(command) => match command {
                    Command::List => {
                        let peers = inst.peers.read().await;
                        println!("{} clients available", peers.len());
                        for p in peers.values() {
                            let username = p
                                .username
                                .read()
                                .await
                                .clone()
                                .unwrap_or("<unknown>".to_string());
                            println!("{username}:");
                            for (rid, r) in p.remote_provided.read().await.iter() {
                                println!(
                                    "\t{rid:?}: {} {:?}",
                                    r.kind,
                                    r.label.clone().unwrap_or_default()
                                )
                            }
                        }
                    }
                    Command::Provide { path, id } => {
                        inst.add_local_resource(Box::new(FileSender {
                            info: ProvideInfo {
                                id: id.unwrap_or("file".to_owned()),
                                kind: "file".to_string(),
                                track_kind: None,
                                label: Some(
                                    path.file_name().unwrap().to_str().unwrap().to_string(),
                                ),
                                size: Some(fs::metadata(&path).await.unwrap().size() as usize),
                            },
                            path: path.into(),
                        }))
                        .await;
                    }
                    Command::Download { id, path } => {
                        let peers = inst.peers.read().await;
                        'outer: for p in peers.values() {
                            for (rid, r) in p.remote_provided.read().await.iter() {
                                if rid == &id {
                                    if r.kind == "file" {
                                        state
                                            .write()
                                            .await
                                            .requested
                                            .insert(id.clone(), Box::new(DownloadHandler { path }));
                                        p.request_resource(id).await;
                                    } else {
                                        warn!("not a file");
                                    }
                                    break 'outer;
                                }
                            }
                        }
                    }
                    Command::Expose { port, id } => {
                        inst.add_local_resource(Box::new(PortExposer {
                            port,
                            info: ProvideInfo {
                                kind: "port".to_string(),
                                id: id.unwrap_or(format!("p{port}")),
                                track_kind: None,
                                label: Some(format!("port {port}")),
                                size: None,
                            },
                        }))
                        .await;
                    }
                    Command::Forward { id, port } => {
                        let peers = inst.peers.read().await;
                        'outer: for peer in peers.values() {
                            for (rid, r) in peer.remote_provided.read().await.iter() {
                                if rid == &id {
                                    if r.kind == "port" {
                                        let peer = peer.to_owned();
                                        let state = state.clone();
                                        tokio::task::spawn(async move {
                                            let Ok(listener) =
                                                TcpListener::bind(("127.0.0.1", port.unwrap_or(0)))
                                                    .await
                                            else {
                                                error!("cannot bind tcp listener");
                                                return;
                                            };
                                            info!(
                                                "tcp listener bound to {}",
                                                listener.local_addr().unwrap()
                                            );
                                            while let Ok((stream, addr)) = listener.accept().await {
                                                info!("new connection from {addr:?}");
                                                state.write().await.requested.insert(
                                                    id.clone(),
                                                    Box::new(ForwardHandler {
                                                        stream: Arc::new(RwLock::new(Some(stream))),
                                                    }),
                                                );
                                                peer.request_resource(id.clone()).await;
                                            }
                                        });
                                    } else {
                                        warn!("not a port");
                                    }
                                    break 'outer;
                                }
                            }
                        }
                    }
                },
                Err(err) => err.print().unwrap(),
            },
            Err(ReadlineError::Eof) => {
                info!("exit");
                break;
            }
            Err(ReadlineError::Interrupted) => {
                info!("interrupted; exiting...");
                break;
            }
            Err(e) => Err(e)?,
        }
    }

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
