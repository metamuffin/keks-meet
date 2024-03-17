/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/

pub mod file;
pub mod port;

use clap::{ColorChoice, Parser};
use file::FileSender;
use libkeks::{
    instance::Instance,
    peer::{Peer, TransportChannel},
    protocol::ProvideInfo,
    Config, DynFut, EventHandler,
};
use log::{info, warn};
use port::PortExposer;
use rustyline::{error::ReadlineError, DefaultEditor};
use std::{collections::HashMap, os::unix::prelude::MetadataExt, path::PathBuf, sync::Arc};
use tokio::{fs, sync::RwLock};
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
                    Command::Forward { id, port } => {}
                },
                Err(err) => err.print().unwrap(),
            },
            Err(ReadlineError::Interrupted) => {
                info!("interrupted; exiting...");
                break;
            }
            Err(e) => Err(e)?,
        }
    }

    // match &args.action {
    //     Action::Send { filename } => {
    //         inst.add_local_resource(Box::new(FileSender {
    //             info: ProvideInfo {
    //                 id: "the-file".to_string(), // we only share a single file so its fine
    //                 kind: "file".to_string(),
    //                 track_kind: None,
    //                 label: Some(filename.clone().unwrap_or("stdin".to_string())),
    //                 size: if let Some(filename) = &filename {
    //                     Some(fs::metadata(filename).await.unwrap().size() as usize)
    //                 } else {
    //                     None
    //                 },
    //             },
    //             reader_factory: args.action,
    //         }))
    //         .await;
    //     }
    //     _ => (),
    // }
    Ok(())
}

struct State {
    requested: HashMap<String, Box<dyn RequestHandler>>,
}
pub trait RequestHandler: Send + Sync + 'static {
    
}

#[derive(Clone)]
struct Handler {
    state: Arc<RwLock<State>>,
}

impl EventHandler for Handler {
    fn peer_join(&self, _peer: Arc<Peer>) -> libkeks::DynFut<()> {
        Box::pin(async move {})
    }

    fn peer_leave(&self, _peer: Arc<Peer>) -> libkeks::DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_added(&self, peer: Arc<Peer>, info: libkeks::protocol::ProvideInfo) -> DynFut<()> {
        let id = info.id.clone();
        Box::pin(async move {
            // match &args.action {
            //     Action::Receive { .. } => {
            //         if info.kind == "file" {
            //             peer.request_resource(id).await;
            //         }
            //     }
            //     _ => (),
            // }
        })
    }
    fn resource_removed(&self, _peer: Arc<Peer>, _id: String) -> DynFut<()> {
        Box::pin(async {})
    }

    fn resource_connected(
        &self,
        _peer: Arc<Peer>,
        resource: &ProvideInfo,
        channel: TransportChannel,
    ) -> libkeks::DynFut<()> {
        let resource = resource.clone();
        let s = self.clone();
        Box::pin(async move {
            // match channel {
            //     TransportChannel::Track(_) => warn!("wrong type"),
            //     TransportChannel::DataChannel(dc) => {
            //         if resource.kind != "file" {
            //             return error!("we got a non-file resource for some reason…");
            //         }
            //         let pos = Arc::new(AtomicUsize::new(0));
            //         let writer: Arc<RwLock<Option<Pin<Box<dyn AsyncWrite + Send + Sync>>>>> =
            //             Arc::new(RwLock::new(None));
            //         {
            //             let writer = writer.clone();
            //             let s = s.clone();
            //             dc.on_open(Box::new(move || {
            //                 let s = s.clone();
            //                 let writer = writer.clone();
            //                 Box::pin(async move {
            //                     info!("channel opened");
            //                     *writer.write().await = Some(s.args.action.create_writer().await)
            //                 })
            //             }));
            //         }
            //         {
            //             let writer = writer.clone();
            //             dc.on_close(Box::new(move || {
            //                 let writer = writer.clone();
            //                 Box::pin(async move {
            //                     info!("channel closed");
            //                     *writer.write().await = None;
            //                     exit(0);
            //                 })
            //             }));
            //         }
            //         {
            //             let writer = writer.clone();
            //             dc.on_message(Box::new(move |mesg| {
            //                 let writer = writer.clone();
            //                 let pos = pos.clone();
            //                 Box::pin(async move {
            //                     // TODO
            //                     if mesg.is_string {
            //                         let s = String::from_utf8((&mesg.data).to_vec()).unwrap();
            //                         if &s == "end" {
            //                             info!("EOF reached")
            //                         }
            //                     } else {
            //                         let pos = pos.fetch_add(mesg.data.len(), Ordering::Relaxed);
            //                         info!(
            //                             "recv {:?} ({} of {})",
            //                             mesg.data.len(),
            //                             humansize::format_size(pos, DECIMAL),
            //                             humansize::format_size(resource.size.unwrap_or(0), DECIMAL),
            //                         );
            //                         writer
            //                             .write()
            //                             .await
            //                             .as_mut()
            //                             .unwrap()
            //                             .write_all(&mesg.data)
            //                             .await
            //                             .unwrap();
            //                     }
            //                 })
            //             }))
            //         }
            //         dc.on_error(Box::new(move |err| {
            //             Box::pin(async move {
            //                 error!("data channel errored: {err}");
            //             })
            //         }));
            //     }
            // }
        })
    }
}

// impl Action {
//     pub async fn create_writer(&self) -> Pin<Box<dyn AsyncWrite + Send + Sync + 'static>> {
//         match self {
//             Action::Receive { filename } => {
//                 if let Some(filename) = filename {
//                     Box::pin(File::create(filename).await.unwrap())
//                 } else {
//                     Box::pin(stdout())
//                 }
//             }
//             _ => unreachable!(),
//         }
//     }
//     pub async fn create_reader(&self) -> Pin<Box<dyn AsyncRead + Send + Sync + 'static>> {
//         match self {
//             Action::Send { filename } => {
//                 if let Some(filename) = filename {
//                     Box::pin(File::open(filename).await.unwrap())
//                 } else {
//                     Box::pin(stdin())
//                 }
//             }
//             _ => unreachable!(),
//         }
//     }
// }
