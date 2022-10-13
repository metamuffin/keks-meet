/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
#![feature(box_syntax)]

use bytes::Bytes;
use clap::{Parser, Subcommand};
use client_native_lib::{
    instance::Instance,
    peer::{Peer, TransportChannel},
    protocol::ProvideInfo,
    webrtc::data_channel::RTCDataChannel,
    Config, DynFut, EventHandler, LocalResource,
};
use log::{error, info, warn};
use std::{future::Future, pin::Pin, sync::Arc};
use tokio::{
    fs::File,
    io::{stdin, stdout, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::RwLock,
};

fn main() {
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
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
    /// username for the `identify` packet
    #[clap(short, long, default_value = "guest")]
    username: String,
    /// pre-shared secret (aka. room name)
    #[clap(short, long)]
    secret: String,
    #[clap(subcommand)]
    action: Action,
}

async fn run() {
    let args = Args::parse();

    let inst = Instance::new(
        Config {
            secret: args.secret.clone(),
            signaling_uri: args.signaling_uri.clone(),
            username: args.username.clone(),
        },
        Arc::new(Handler {
            args: Arc::new(args.clone()),
        }),
    )
    .await;

    inst.receive_loop().await;

    tokio::signal::ctrl_c().await.unwrap();
    error!("interrupt received, exiting");
}

#[derive(Clone)]
struct Handler {
    args: Arc<Args>,
}

impl EventHandler for Handler {
    fn peer_join(&self, peer: Arc<Peer>) -> client_native_lib::DynFut<()> {
        Box::pin(async move {})
    }

    fn peer_leave(&self, peer: Arc<Peer>) -> client_native_lib::DynFut<()> {
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
                Action::Send { filename } => {}
                Action::Receive { filename } => {
                    if info.kind == "file" {
                        peer.request_resource(id).await;
                    }
                }
            }
        })
    }
    fn resource_removed(&self, peer: Arc<Peer>, id: String) -> DynFut<()> {
        Box::pin(async {})
    }

    fn resource_connected(
        &self,
        peer: Arc<Peer>,
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
                    let writer: Arc<RwLock<Option<Pin<Box<dyn AsyncWrite + Send + Sync>>>>> =
                        Arc::new(RwLock::new(None));
                    {
                        let writer = writer.clone();
                        dc.on_open(box move || {
                            let s = s.clone();
                            let writer = writer.clone();
                            Box::pin(async move {
                                info!("channel opened");
                                *writer.write().await = Some(s.args.action.create_writer().await)
                            })
                        })
                        .await;
                    }
                    {
                        let writer = writer.clone();
                        dc.on_close(box move || {
                            let writer = writer.clone();
                            Box::pin(async move {
                                info!("channel closed");
                                *writer.write().await = None;
                            })
                        })
                        .await;
                    }
                    {
                        let writer = writer.clone();
                        dc.on_message(box move |mesg| {
                            let writer = writer.clone();
                            Box::pin(async move {
                                info!("{:?} bytes of data", mesg.data.len());
                                writer
                                    .write()
                                    .await
                                    .as_mut()
                                    .unwrap()
                                    .write(&mesg.data)
                                    .await
                                    .unwrap();
                            })
                        })
                    }
                    .await;
                    dc.on_error(box move |err| {
                        Box::pin(async move {
                            error!("data channel errored: {err}");
                        })
                    })
                    .await;
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
    info: ProvideInfo,
}
impl LocalResource for FileSender {
    fn info(&self) -> client_native_lib::protocol::ProvideInfo {
        self.info.clone()
    }

    fn on_request(&self, peer: Arc<Peer>) -> DynFut<()> {
        Box::pin(async move {})
    }
}

// pub struct Conn {
//     pub args: Arc<Args>,
// }
// pub struct PeerState {
//     args: Arc<Args>,
//     peer: Arc<Peer>,
// }

// impl PeerInit<PeerState> for Conn {
//     fn add_peer(
//         &self,
//         peer: Arc<Peer>,
//     ) -> Pin<Box<(dyn Future<Output = Arc<PeerState>> + Send + Sync + 'static)>> {
//         let args = self.args.clone();
//         Box::pin(async move {
//             let p = Arc::new(PeerState { peer, args });
//             p.clone().init().await;
//             p
//         })
//     }
// }
// impl HasPeer for PeerState {
//     fn peer(&self) -> &Arc<Peer> {
//         &self.peer
//     }
// }
// impl PeerState {
//     pub async fn init(self: Arc<Self>) {
//         let s = self.clone();
//         match &self.args.action {
//             Action::Send { .. } => self.init_send_channel().await,
//             Action::Receive { .. } => {
//                 self.peer
//                     .peer_connection
//                     .on_data_channel(box move |ch| {
//                         let s = s.clone();
//                         Box::pin(async move { s.init_receive_channel(ch).await })
//                     })
//                     .await;
//             }
//         }
//     }

//     pub async fn init_receive_channel(self: Arc<Self>, channel: Arc<RTCDataChannel>) {
//         info!("got a data channel");
//         let writer = Arc::new(RwLock::new(None));
//         {
//             let writer = writer.clone();
//             channel
//                 .on_open(box move || {
//                     info!("channel opened");
//                     Box::pin(async move {
//                         *writer.write().await = Some(self.args.action.create_writer().await);
//                     })
//                 })
//                 .await;
//         }
//         {
//             let writer = writer.clone();
//             channel
//                 .on_close(box move || {
//                     info!("channel closed");
//                     let writer = writer.clone();
//                     Box::pin(async move {
//                         *writer.write().await = None; // drop the writer, so it closes the file or whatever
//                     })
//                 })
//                 .await;
//         }
//         {
//             let writer = writer.clone();
//             channel
//                 .on_message(box move |mesg| {
//                     let writer = writer.clone();
//                     Box::pin(async move {
//                         writer
//                             .write()
//                             .await
//                             .as_mut()
//                             .unwrap()
//                             .write_all(&mesg.data)
//                             .await
//                             .unwrap();
//                     })
//                 })
//                 .await;
//         }
//         channel
//             .on_error(box move |err| {
//                 info!("channel error: {err:?}");
//                 Box::pin(async {})
//             })
//             .await;
//     }

//     pub async fn init_send_channel(&self) {
//         info!("creating data channel");
//         let data_channel = self
//             .peer
//             .peer_connection
//             .create_data_channel("file-transfer", None)
//             .await
//             .unwrap();
//         let weak = Arc::downgrade(&data_channel);
//         let args = self.args.clone();
//         data_channel
//             .on_open(box move || {
//                 let args = args.clone();
//                 let data_channel = weak.upgrade().unwrap();
//                 Box::pin(async move {
//                     let mut reader = args.action.create_reader().await;
//                     info!("starting transmission");
//                     loop {
//                         let mut buf = [0u8; 4096];
//                         let size = reader.read(&mut buf).await.unwrap();
//                         if size == 0 {
//                             break;
//                         }
//                         data_channel
//                             .send(&Bytes::from_iter(buf[0..size].into_iter().map(|e| *e)))
//                             .await
//                             .unwrap();
//                     }
//                     info!("transmission finished");
//                     drop(reader);
//                     info!("now closing the channel again…");
//                     data_channel.close().await.unwrap();
//                 })
//             })
//             .await;
//         data_channel
//             .on_close(box || Box::pin(async move { info!("data channel closed") }))
//             .await;
//         data_channel
//             .on_error(box |err| Box::pin(async move { error!("data channel error: {err}") }))
//             .await;
//     }
// }
