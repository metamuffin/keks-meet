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
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

fn main() {
    env_logger::builder()
        .filter_module("keks_meet_export_track", log::LevelFilter::Info)
        .filter_module("client_native_lib", log::LevelFilter::Info)
        .filter_module("webrtc", log::LevelFilter::Error)
        .parse_env("LOG")
        .init();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
}

#[derive(Parser, Clone)]
/// exports any kind of track from a keks-meet conference.
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
    /// interval to send "picture loss indicator" to the remote
    #[clap(long)]
    pli_interval: Option<f64>,
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
            requested_track: Arc::new(AtomicBool::new(false)),
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
    requested_track: Arc<AtomicBool>,
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
        let r = self.requested_track.clone();
        Box::pin(async move {
            if info.kind == "track" {
                info!("track of interest is provided, requesting");
                if !r.swap(true, Ordering::Relaxed) {
                    peer.request_resource(id).await;
                }
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
        let peer = Arc::downgrade(&peer);
        let args = Arc::downgrade(&self._args);
        Box::pin(async move {
            match channel {
                TransportChannel::Track(track) => {
                    let args = args.upgrade().unwrap();
                    let peer = peer.upgrade().unwrap();

                    info!("got track remote!");
                    if let Some(pli_interval) = args.pli_interval {
                        let media_ssrc = track.ssrc();
                        let peer = peer.clone();
                        tokio::spawn(async move {
                            loop {
                                tokio::time::sleep(Duration::from_secs_f64(pli_interval)).await;
                                debug!("sending pli");
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
                            }
                        });
                    }

                    if let Err(e) = export(track.clone()).await {
                        error!("export failed: {e}")
                    }
                    info!("stopping, telling the remote to stop too.");
                    peer.request_stop_resource(track.stream_id().await).await;
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
