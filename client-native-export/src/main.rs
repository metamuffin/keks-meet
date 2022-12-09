/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
#![feature(box_syntax)]

use clap::Parser;
use client_native_lib::{
    instance::Instance,
    peer::{Peer, TransportChannel},
    protocol::ProvideInfo,
    webrtc::{
        rtcp::payload_feedbacks::picture_loss_indication::PictureLossIndication,
        rtp::{codecs::h264::H264Packet, packetizer::Depacketizer},
        track::track_remote::TrackRemote,
    },
    Config, DynFut, EventHandler,
};
use log::{debug, error, info, warn};
use std::{
    io::{stdout, Write},
    sync::Arc,
    time::Duration,
};

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
    /// username for the `identify` packet
    #[clap(short, long, default_value = "guest")]
    username: String,
    /// pre-shared secret (aka. room name)
    #[clap(short, long)]
    secret: String,
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
            _args: Arc::new(args.clone()),
        }),
    )
    .await;

    inst.spawn_ping().await;
    inst.receive_loop().await;

    tokio::signal::ctrl_c().await.unwrap();
    error!("interrupt received, exiting");
}

#[derive(Clone)]
struct Handler {
    _args: Arc<Args>,
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
        Box::pin(async move {
            if info.kind == "track" {
                peer.request_resource(id).await;
            }
        })
    }
    fn resource_removed(&self, _peer: Arc<Peer>, _id: String) -> DynFut<()> {
        Box::pin(async {})
    }

    fn resource_connected(
        &self,
        peer: Arc<Peer>,
        _resource: &ProvideInfo,
        channel: TransportChannel,
    ) -> client_native_lib::DynFut<()> {
        // let resource = resource.clone();
        // let s = self.clone();
        let peer = Arc::downgrade(&peer);
        Box::pin(async move {
            match channel {
                TransportChannel::Track(track) => {
                    let media_ssrc = track.ssrc();
                    let peer = peer.clone();
                    tokio::spawn(async move {
                        loop {
                            tokio::time::sleep(Duration::from_secs(3)).await;
                            let peer = peer.upgrade().unwrap();
                            let r = peer
                                .peer_connection
                                .write_rtcp(&[Box::new(PictureLossIndication {
                                    sender_ssrc: 0,
                                    media_ssrc,
                                })])
                                .await;
                            if r.is_err() {
                                break;
                            }
                            debug!("trigger keyframe");
                        }
                    });

                    export(track).await.unwrap();
                }
                TransportChannel::DataChannel(_) => warn!("wrong type"),
            }
        })
    }
}

async fn export(track: Arc<TrackRemote>) -> anyhow::Result<()> {
    let mut cached_packet = H264Packet::default();
    info!("depacketizing rtp to stdout");
    loop {
        let (packet, _) = track.read_rtp().await?;
        if !packet.payload.is_empty() {
            let raw_payload = cached_packet.depacketize(&packet.payload)?;
            stdout().write_all(&raw_payload)?;
        }
    }
}
