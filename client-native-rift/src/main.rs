#![feature(box_syntax)]

use bytes::Bytes;
use clap::{Parser, Subcommand};
use client_native_lib::{
    connect,
    peer::Peer,
    state::{HasPeer, PeerInit},
    webrtc::data_channel::RTCDataChannel,
    Config,
};
use log::{error, info};
use std::{future::Future, pin::Pin, sync::Arc};
use tokio::{
    io::{stdin, stdout, AsyncReadExt, AsyncWriteExt},
    sync::RwLock,
};

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

    connect(
        Config {
            secret: args.secret.clone(),
            signaling_host: args.signaling_host.clone(),
        },
        Arc::new(Conn {
            args: Arc::new(args),
        }),
    )
    .await;

    tokio::signal::ctrl_c().await.unwrap();
    error!("interrupt received, exiting");
}

pub struct Conn {
    pub args: Arc<Args>,
}
pub struct PeerState {
    args: Arc<Args>,
    peer: Arc<Peer>,
    channel: RwLock<Option<Arc<RTCDataChannel>>>,
}

impl PeerInit<PeerState> for Conn {
    fn add_peer(
        &self,
        peer: Arc<Peer>,
    ) -> Pin<Box<(dyn Future<Output = Arc<PeerState>> + Send + Sync + 'static)>> {
        let args = self.args.clone();
        Box::pin(async move {
            let p = Arc::new(PeerState {
                peer,
                args,
                channel: Default::default(),
            });
            p.clone().init().await;
            p
        })
    }
}
impl HasPeer for PeerState {
    fn peer(&self) -> &Arc<Peer> {
        &self.peer
    }
}
impl PeerState {
    pub async fn init(self: Arc<Self>) {
        let s = self.clone();
        match &self.args.action {
            Action::Send {} => *s.channel.write().await = Some(self.init_send_channel().await),
            Action::Receive {} => {
                self.peer
                    .peer_connection
                    .on_data_channel(box move |ch| {
                        let s = s.clone();
                        Box::pin(async move {
                            *s.channel.write().await = Some(ch);
                            s.init_receive_channel().await
                        })
                    })
                    .await;
            }
        }
    }

    pub async fn init_receive_channel(self: Arc<Self>) {
        info!("got a data channel");
        let ch = self.channel.read().await.as_ref().unwrap().clone();
        ch.on_open(box move || {
            info!("channel opened");
            Box::pin(async {})
        })
        .await;
        ch.on_close(box move || {
            info!("channel closed");
            Box::pin(async {})
        })
        .await;
        ch.on_error(box move |err| {
            info!("channel error: {err:?}");
            Box::pin(async {})
        })
        .await;
        ch.on_message(box move |mesg| {
            Box::pin(async move { stdout().write_all(&mesg.data).await.unwrap() })
        })
        .await;
    }

    pub async fn init_send_channel(&self) -> Arc<RTCDataChannel> {
        info!("creating data channel");
        let data_channel = self
            .peer
            .peer_connection
            .create_data_channel("file-transfer", None)
            .await
            .unwrap();
        {
            let dc2 = data_channel.clone();
            data_channel
                .on_open(box move || {
                    let data_channel = dc2.clone();
                    Box::pin(async move {
                        loop {
                            let mut buf = [0u8; 1024];
                            let size = stdin().read(&mut buf).await.unwrap();
                            data_channel
                                .send(&Bytes::from_iter(buf[0..size].into_iter().map(|e| *e)))
                                .await
                                .unwrap();
                        }
                    })
                })
                .await;
        }

        data_channel
    }
}
