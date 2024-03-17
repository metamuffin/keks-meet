/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/

use bytes::Bytes;
use clap::{Parser, Subcommand};
use client_native_lib::{
    instance::Instance,
    peer::{Peer, TransportChannel},
    protocol::ProvideInfo,
    Config, DynFut, EventHandler, LocalResource,
};
use humansize::DECIMAL;
use log::{debug, error, info, warn};
use std::{
    os::unix::prelude::MetadataExt,
    pin::Pin,
    process::exit,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};
use tokio::{
    fs::{self, File},
    io::{stdin, stdout, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::RwLock,
};
use users::get_current_username;

fn main() {
    env_logger::builder()
        .filter_module("rift", log::LevelFilter::Info)
        .filter_module("client_native_lib", log::LevelFilter::Info)
        .parse_env("LOG")
        .init();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
}

#[derive(Parser, Clone)]
pub struct Args {
    /// keks-meet server used for establishing p2p connection
    #[clap(long, default_value = "wss://meet.metamuffin.org")]
    signaling_uri: String,
    /// username override
    #[clap(short, long, default_value_t = get_username())]
    username: String,
    /// pre-shared secret (aka. room name)
    #[clap(short, long)]
    secret: String,
    #[clap(subcommand)]
    action: Action,
    /// end after completion of the first transfer
    #[clap(short, long)]
    one_file: bool,
}

fn get_username() -> String {
    get_current_username()
        .map(|u| u.to_str().unwrap().to_string())
        .unwrap_or("guest".to_string())
        .to_owned()
}

async fn run() {
    let args = Args::parse();

    let inst = Instance::new(
        Config {
            signaling_uri: args.signaling_uri.clone(),
            username: args.username.clone(),
        },
        Arc::new(Handler {
            args: Arc::new(args.clone()),
        }),
    )
    .await;

    inst.join(Some(&args.secret)).await;

    match &args.action {
        Action::Send { filename } => {
            inst.add_local_resource(Box::new(FileSender {
                info: ProvideInfo {
                    id: "the-file".to_string(), // we only share a single file so its fine
                    kind: "file".to_string(),
                    track_kind: None,
                    label: Some(filename.clone().unwrap_or("stdin".to_string())),
                    size: if let Some(filename) = &filename {
                        Some(fs::metadata(filename).await.unwrap().size() as usize)
                    } else {
                        None
                    },
                },
                reader_factory: args.action,
            }))
            .await;
        }
        _ => (),
    }

    inst.spawn_ping().await;
    inst.receive_loop().await;

    tokio::signal::ctrl_c().await.unwrap();
    error!("interrupt received, exiting");
}

#[derive(Clone)]
struct Handler {
    args: Arc<Args>,
}

impl EventHandler for Handler {
    fn peer_join(&self, _peer: Arc<Peer>) -> client_native_lib::DynFut<()> {
        Box::pin(async move {})
    }

    fn peer_leave(&self, _peer: Arc<Peer>) -> client_native_lib::DynFut<()> {
        Box::pin(async move {})
    }
    fn resource_added(
        &self,
        peer: Arc<Peer>,
        info: client_native_lib::protocol::ProvideInfo,
    ) -> DynFut<()> {
        let id = info.id.clone();
        let args = self.args.clone();
        Box::pin(async move {
            match &args.action {
                Action::Receive { .. } => {
                    if info.kind == "file" {
                        peer.request_resource(id).await;
                    }
                }
                _ => (),
            }
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
    ) -> client_native_lib::DynFut<()> {
        let resource = resource.clone();
        let s = self.clone();
        Box::pin(async move {
            match channel {
                TransportChannel::Track(_) => warn!("wrong type"),
                TransportChannel::DataChannel(dc) => {
                    if resource.kind != "file" {
                        return error!("we got a non-file resource for some reason…");
                    }
                    let pos = Arc::new(AtomicUsize::new(0));
                    let writer: Arc<RwLock<Option<Pin<Box<dyn AsyncWrite + Send + Sync>>>>> =
                        Arc::new(RwLock::new(None));
                    {
                        let writer = writer.clone();
                        let s = s.clone();
                        dc.on_open(Box::new(move || {
                            let s = s.clone();
                            let writer = writer.clone();
                            Box::pin(async move {
                                info!("channel opened");
                                *writer.write().await = Some(s.args.action.create_writer().await)
                            })
                        }));
                    }
                    {
                        let writer = writer.clone();
                        let args = s.args.clone();
                        dc.on_close(Box::new(move || {
                            let writer = writer.clone();
                            let args = args.clone();
                            Box::pin(async move {
                                info!("channel closed");
                                *writer.write().await = None;
                                if args.one_file {
                                    exit(0);
                                }
                            })
                        }));
                    }
                    {
                        let writer = writer.clone();
                        dc.on_message(Box::new(move |mesg| {
                            let writer = writer.clone();
                            let pos = pos.clone();
                            Box::pin(async move {
                                // TODO
                                if mesg.is_string {
                                    let s = String::from_utf8((&mesg.data).to_vec()).unwrap();
                                    if &s == "end" {
                                        info!("EOF reached")
                                    }
                                } else {
                                    let pos = pos.fetch_add(mesg.data.len(), Ordering::Relaxed);
                                    info!(
                                        "recv {:?} ({} of {})",
                                        mesg.data.len(),
                                        humansize::format_size(pos, DECIMAL),
                                        humansize::format_size(resource.size.unwrap_or(0), DECIMAL),
                                    );
                                    writer
                                        .write()
                                        .await
                                        .as_mut()
                                        .unwrap()
                                        .write_all(&mesg.data)
                                        .await
                                        .unwrap();
                                }
                            })
                        }))
                    }
                    dc.on_error(Box::new(move |err| {
                        Box::pin(async move {
                            error!("data channel errored: {err}");
                        })
                    }));
                }
            }
        })
    }
}

#[derive(Subcommand, Clone)]
pub enum Action {
    /// Send a file
    Send { filename: Option<String> },
    /// Receive a file
    Receive { filename: Option<String> },
}

impl Action {
    pub async fn create_writer(&self) -> Pin<Box<dyn AsyncWrite + Send + Sync + 'static>> {
        match self {
            Action::Receive { filename } => {
                if let Some(filename) = filename {
                    Box::pin(File::create(filename).await.unwrap())
                } else {
                    Box::pin(stdout())
                }
            }
            _ => unreachable!(),
        }
    }
    pub async fn create_reader(&self) -> Pin<Box<dyn AsyncRead + Send + Sync + 'static>> {
        match self {
            Action::Send { filename } => {
                if let Some(filename) = filename {
                    Box::pin(File::open(filename).await.unwrap())
                } else {
                    Box::pin(stdin())
                }
            }
            _ => unreachable!(),
        }
    }
}

struct FileSender {
    reader_factory: Action, // TODO use Box<dyn Fn() -> DynFut<dyn AsyncRead + Send + Sync> + Send + Sync>,
    info: ProvideInfo,
}

impl LocalResource for FileSender {
    fn info(&self) -> ProvideInfo {
        self.info.clone()
    }

    fn on_request(&self, peer: Arc<Peer>) -> DynFut<()> {
        let id = self.info().id.clone();
        let total_size = self.info().size.unwrap_or(0);
        let reader_factory = self.reader_factory.clone();
        Box::pin(async move {
            let channel = peer
                .peer_connection
                .create_data_channel(&id, None)
                .await
                .unwrap();
            let pos = Arc::new(AtomicUsize::new(0));
            let reader: Arc<RwLock<Option<Pin<Box<dyn AsyncRead + Send + Sync>>>>> =
                Arc::new(RwLock::new(None));
            {
                let reader = reader.clone();
                let reader_factory = reader_factory.clone();
                channel.on_open(Box::new(move || {
                    let reader = reader.clone();
                    Box::pin(async move {
                        info!("channel open");
                        *reader.write().await = Some(reader_factory.create_reader().await);
                    })
                }))
            }
            {
                let reader = reader.clone();
                channel.on_close(Box::new(move || {
                    let reader = reader.clone();
                    Box::pin(async move {
                        info!("channel closed");
                        *reader.write().await = None;
                    })
                }))
            }
            {
                let reader = reader.clone();
                let pos = pos.clone();
                let channel2 = channel.clone();
                channel
                    .on_buffered_amount_low(Box::new(move || {
                        let pos = pos.clone();
                        let reader = reader.clone();
                        let channel = channel2.clone();
                        Box::pin(async move {
                            debug!("buffered amount low");
                            let mut buf = [0u8; 1 << 15];
                            let size = reader
                                .write()
                                .await
                                .as_mut()
                                .unwrap()
                                .read(&mut buf)
                                .await
                                .unwrap();
                            if size == 0 {
                                info!("reached EOF, closing channel");
                                channel.close().await.unwrap();
                            } else {
                                let progress_size = pos.fetch_add(size, Ordering::Relaxed);
                                info!(
                                    "sending {size} bytes ({} of {})",
                                    humansize::format_size(progress_size, DECIMAL),
                                    humansize::format_size(total_size, DECIMAL),
                                );
                                channel
                                    .send(&Bytes::copy_from_slice(&buf[..size]))
                                    .await
                                    .unwrap();
                            }
                        })
                    }))
                    .await;
                channel.set_buffered_amount_low_threshold(1).await;
            }
            channel.on_error(Box::new(move |err| {
                Box::pin(async move { error!("channel error: {err}") })
            }))
        })
    }
}
