/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
#![feature(box_syntax)]

pub mod chat;

use async_std::task::block_on;
use chat::Chat;
use clap::Parser;
use client_native_lib::{
    instance::Instance,
    peer::Peer,
    protocol::{ProvideInfo, RelayMessage},
    webrtc::{
        rtcp::payload_feedbacks::picture_loss_indication::PictureLossIndication,
        rtp::{codecs::h264::H264Packet, packetizer::Depacketizer},
        track::track_remote::TrackRemote,
    },
    Config, EventHandler,
};
use crossbeam_channel::Sender;
use eframe::egui;
use egui::{ScrollArea, Ui, Visuals};
use log::{debug, error, warn};
use std::{
    collections::{HashMap, VecDeque},
    fs::File,
    io::Write,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, RwLock,
    },
    thread,
    time::Duration,
};
use tokio::task::JoinHandle;

#[derive(Parser)]
#[clap(about)]
/// A graphical interface to keks-meet conferences
struct Args {
    #[arg(short = 'R', long, default_value = "")]
    default_room_secret: String,
    #[arg(short = 'U', long, default_value = "alice")]
    default_username: String,
}

#[tokio::main]
async fn main() {
    env_logger::builder()
        .filter_module("keks_meet", log::LevelFilter::Info)
        .filter_module("client_native_lib", log::LevelFilter::Info)
        .parse_env("LOG")
        .init();

    let args = Args::parse();

    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "keks-meet",
        options,
        Box::new(|cc| {
            cc.egui_ctx.set_visuals(Visuals {
                dark_mode: true,
                ..Default::default()
            });
            Box::new(App::new(args))
        }),
    )
    .unwrap();
}

enum App {
    Prejoin(String, String),
    Joining(Option<JoinHandle<Ingame>>),
    Ingame(Ingame),
}

#[derive(Clone)]
// TODO
#[allow(dead_code)]
struct Ingame {
    pub instance: Arc<Instance>,
    pub handler: Arc<Handler>,
    pub chat: Arc<RwLock<Chat>>,
}

pub struct Handler {
    k: RwLock<Option<Ingame>>,
    peers: RwLock<HashMap<usize, Arc<RwLock<GuiPeer>>>>,
}

pub struct GuiPeer {
    peer: Arc<Peer>,
    resources: HashMap<String, GuiResource>,
    username: Option<String>,
}

struct GuiResource {
    info: ProvideInfo,
    state: Arc<RwLock<GuiResourceState>>,
}

#[derive(Debug, Clone)]
enum GuiResourceState {
    Available,
    Connecting,
    Connected,
    Disconnecting,
}

impl App {
    pub fn new(args: Args) -> Self {
        Self::Prejoin(args.default_room_secret, args.default_username)
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| match self {
            App::Prejoin(secret, username) => {
                ui.heading("Join a meeting");
                ui.label("Room secret:");
                ui.text_edit_singleline(secret);
                ui.label("Username:");
                ui.text_edit_singleline(username);
                if ui.button("Join").clicked() {
                    let secret = secret.clone();
                    let username = username.clone();
                    *self = Self::Joining(Some(tokio::spawn(async move {
                        Ingame::new(Config {
                            secret,
                            username,
                            signaling_uri: "wss://meet.metamuffin.org".to_string(),
                        })
                        .await
                    })))
                }
            }
            App::Joining(fut) => {
                ui.spinner();
                if fut.as_ref().map(|f| f.is_finished()).unwrap_or(false) {
                    *self = Self::Ingame(block_on(fut.take().unwrap()).unwrap());
                }
            }
            App::Ingame(x) => x.ui(ui),
        });
    }
}

impl Ingame {
    pub async fn new(config: Config) -> Self {
        let handler = Arc::new(Handler::new());
        let instance = Instance::new(config, handler.clone()).await;
        instance.spawn_ping().await;
        {
            let instance = instance.clone();
            tokio::spawn(instance.receive_loop());
        }
        let k = Self {
            chat: Arc::new(RwLock::new(Chat::new(instance.clone()))),
            instance,
            handler,
        };
        *k.handler.k.write().unwrap() = Some(k.clone());
        k
    }

    pub fn ui(&mut self, ui: &mut Ui) {
        egui::SidePanel::left("chat")
            .resizable(true)
            .default_width(100.0)
            .width_range(100.0..=1000.0)
            .show_inside(ui, |ui| {
                self.chat.write().unwrap().ui(ui);
                ui.allocate_space(ui.available_size());
            });
        egui::CentralPanel::default().show_inside(ui, |ui| {
            self.ui_user_list(ui);
        });
    }
    pub fn ui_user_list(&self, ui: &mut Ui) {
        ScrollArea::vertical()
            .id_source("user-list")
            .show(ui, |ui| {
                for gp in self.handler.peers.write().unwrap().values_mut() {
                    let mut gp = gp.write().unwrap();
                    ui.collapsing(gp.display_name(), |ui| {
                        let peer = gp.peer.clone();
                        for resource in gp.resources.values_mut() {
                            resource.ui(ui, &peer)
                        }
                    });
                }
            });
    }
}
impl GuiResource {
    pub fn ui(&mut self, ui: &mut Ui, peer: &Arc<Peer>) {
        ui.label(&format!(
            "{} {} {:?}",
            self.info.id, self.info.kind, self.info.label
        ));
        let state = self.state.read().unwrap().to_owned();
        match state {
            GuiResourceState::Available => {
                if ui.button("Enable").clicked() {
                    let id = self.info.id.clone();
                    let peer = peer.clone();
                    *self.state.write().unwrap() = GuiResourceState::Connecting;
                    tokio::spawn(async move { peer.request_resource(id).await });
                }
            }
            GuiResourceState::Connecting => {
                ui.horizontal(|ui| {
                    ui.spinner();
                    ui.label("Connecting...")
                });
            }
            GuiResourceState::Disconnecting => {
                ui.horizontal(|ui| {
                    ui.spinner();
                    ui.label("Disconnecting...")
                });
            }
            GuiResourceState::Connected => {
                if ui.button("Disable").clicked() {
                    let id = self.info.id.clone();
                    let peer = peer.clone();
                    *self.state.write().unwrap() = GuiResourceState::Disconnecting;
                    tokio::spawn(async move { peer.request_stop_resource(id).await });
                }
            }
        }
    }
}

impl Handler {
    pub fn new() -> Self {
        Self {
            k: RwLock::new(None),
            peers: Default::default(),
        }
    }
}

impl GuiPeer {
    pub fn display_name(&self) -> String {
        self.username
            .clone()
            .unwrap_or_else(|| format!("Unknown ({})", self.peer.id))
    }
}

impl EventHandler for Handler {
    fn peer_join(
        &self,
        peer: std::sync::Arc<client_native_lib::peer::Peer>,
    ) -> client_native_lib::DynFut<()> {
        self.peers.write().unwrap().insert(
            peer.id,
            Arc::new(RwLock::new(GuiPeer {
                resources: HashMap::new(),
                peer: peer.clone(),
                username: None,
            })),
        );
        Box::pin(async move {})
    }

    fn peer_leave(
        &self,
        peer: std::sync::Arc<client_native_lib::peer::Peer>,
    ) -> client_native_lib::DynFut<()> {
        self.peers.write().unwrap().remove(&peer.id);
        Box::pin(async move {})
    }

    fn resource_added(
        &self,
        peer: std::sync::Arc<client_native_lib::peer::Peer>,
        info: client_native_lib::protocol::ProvideInfo,
    ) -> client_native_lib::DynFut<()> {
        if let Some(gp) = self.peers.write().unwrap().get_mut(&peer.id) {
            gp.write().unwrap().resources.insert(
                info.id.clone(),
                GuiResource {
                    info,
                    state: Arc::new(RwLock::new(GuiResourceState::Available)),
                },
            );
        }
        Box::pin(async move {})
    }

    fn resource_removed(
        &self,
        peer: std::sync::Arc<client_native_lib::peer::Peer>,
        id: String,
    ) -> client_native_lib::DynFut<()> {
        if let Some(gp) = self.peers.write().unwrap().get_mut(&peer.id) {
            gp.write().unwrap().resources.remove(&id);
        }
        Box::pin(async move {})
    }

    fn resource_connected(
        &self,
        peer: std::sync::Arc<client_native_lib::peer::Peer>,
        resource: &client_native_lib::protocol::ProvideInfo,
        channel: client_native_lib::peer::TransportChannel,
    ) -> client_native_lib::DynFut<()> {
        if let Some(gp) = self.peers.write().unwrap().get(&peer.id) {
            let mut gp = gp.write().unwrap();
            let peer = gp.peer.clone();
            if let Some(gr) = gp.resources.get_mut(&resource.id) {
                let state = gr.state.clone();
                *gr.state.write().unwrap() = GuiResourceState::Connected;
                match channel {
                    client_native_lib::peer::TransportChannel::Track(track) => {
                        tokio::task::spawn_blocking(move || {
                            play(peer, track);
                            *state.write().unwrap() = GuiResourceState::Available;
                        });
                    }
                    client_native_lib::peer::TransportChannel::DataChannel(_) => {
                        warn!("cant handle data channel yet")
                    }
                }
            }
        }
        Box::pin(async move {})
    }

    fn on_relay(
        &self,
        peer: Arc<Peer>,
        message: &client_native_lib::protocol::RelayMessage,
    ) -> client_native_lib::DynFut<()> {
        let guard = self.peers.read().unwrap();
        let mut p = guard.get(&peer.id).unwrap().write().unwrap();
        match message.clone() {
            RelayMessage::Identify { username } => p.username = Some(username),
            RelayMessage::Chat(message) => self
                .k
                .read()
                .unwrap()
                .as_ref()
                .unwrap()
                .chat
                .write()
                .unwrap()
                .add(Some(guard.get(&peer.id).unwrap().clone()), message),
            _ => (),
        };
        Box::pin(async move {})
    }
}

pub fn play(peer: Arc<Peer>, track: Arc<TrackRemote>) {
    let rid = block_on(track.stream_id());
    let (exit_tx, exit_rx) = crossbeam_channel::unbounded();
    let has_exited = Arc::new(AtomicBool::new(false));
    let buffer = Arc::new(RwLock::new(VecDeque::new()));

    {
        let buffer = buffer.clone();
        let track = track.clone();
        tokio::spawn(async move {
            if let Err(e) = track_to_raw(track, buffer).await {
                error!("export error: {e}");
            }
        });
    }
    {
        let media_ssrc = track.ssrc();
        let peer = peer.clone();
        let has_exited = has_exited.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(3)).await;
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
                if has_exited.load(Ordering::Relaxed) {
                    break;
                }
            }
            debug!("pli send loop exited");
        });
    }
    type State = (Arc<RwLock<VecDeque<u8>>>, Sender<()>, Arc<AtomicBool>);
    fn open(state: &mut State, uri: &str) -> State {
        debug!("mpv open: {uri}");
        state.clone()
    }
    fn close(state: Box<State>) {
        let _ = state.1.send(());
        debug!("mpv close");
    }
    fn read(state: &mut State, buf: &mut [i8]) -> i64 {
        let mut i = 0;
        debug!("mpv request {} bytes", buf.len());
        // TODO this is horrible
        loop {
            if state.2.load(Ordering::Relaxed) {
                return 0;
            }
            let mut state = state.0.write().unwrap();
            while let Some(e) = state.pop_front() {
                if i >= buf.len() {
                    break;
                }
                buf[i] = e as i8;
                i += 1;
            }
            if i != 0 {
                break;
            }
            drop(state);
            thread::sleep(Duration::from_millis(10));
        }
        debug!("mpv read {i} bytes");
        i as i64
    }

    let mpv = libmpv::Mpv::new().unwrap();
    File::create("/tmp/keks-meet-temp.conf")
        .unwrap()
        .write_all(include_bytes!("../mpv.conf"))
        .unwrap();
    mpv.load_config("/tmp/keks-meet-temp.conf").unwrap();

    let proto = unsafe {
        libmpv::protocol::Protocol::new(
            "keks-meet-track".to_owned(),
            (buffer, exit_tx.clone(), has_exited.clone()),
            open,
            close,
            read,
            None,
            None,
        )
    };
    let proto_ctx = mpv.create_protocol_context();
    let uri = format!("keks-meet-track://{}", rid);
    proto_ctx.register(proto).unwrap();
    mpv.playlist_load_files(&[(&uri, libmpv::FileState::AppendPlay, None)])
        .unwrap();
    mpv.command("show-text", &[&uri, "2000"]).unwrap();

    block_on(track.onmute(move || {
        debug!("track muted");
        let _ = exit_tx.send(());
        Box::pin(async move {})
    }));
    exit_rx.recv().unwrap();
    has_exited.store(true, Ordering::Relaxed);
    block_on(peer.request_stop_resource(rid))
}

async fn track_to_raw(
    track: Arc<TrackRemote>,
    target: Arc<RwLock<VecDeque<u8>>>,
) -> anyhow::Result<()> {
    let mut cached_packet = H264Packet::default();
    loop {
        let (packet, _) = track.read_rtp().await?;
        if !packet.payload.is_empty() {
            let raw_payload = cached_packet.depacketize(&packet.payload)?;
            // let raw_payload = packet.payload;
            if raw_payload.len() != 0 {
                debug!("writing {} bytes", raw_payload.len());

                let mut target = target.write().unwrap();
                if target.len() < 10_000_000 {
                    target.extend(raw_payload.into_iter());
                } else {
                    warn!("buffer is getting too big, dropping some data");
                }
            }
        }
    }
}
