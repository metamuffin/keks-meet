#![feature(box_syntax)]

use async_std::task::block_on;
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
use egui::{Ui, Visuals};
use log::{debug, error, warn};
use std::{
    collections::{HashMap, VecDeque},
    fs::File,
    io::Write,
    ops::Deref,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, RwLock,
    },
    thread,
    time::Duration,
};
use tokio::task::JoinHandle;

#[tokio::main]
async fn main() {
    env_logger::builder()
        .filter_module("keks_meet", log::LevelFilter::Info)
        .filter_module("client_native_lib", log::LevelFilter::Info)
        .parse_env("LOG")
        .init();

    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "keks-meet",
        options,
        Box::new(|cc| {
            cc.egui_ctx.set_visuals(Visuals {
                dark_mode: true,
                ..Default::default()
            });
            Box::new(App::new())
        }),
    );
}

enum App {
    Prejoin(String, String),
    Joining(Option<JoinHandle<Ingame>>),
    Ingame(Ingame),
}

struct Ingame {
    pub instance: Arc<Instance>,
    pub handler: Arc<Handler>,
}

struct Handler {
    peers: RwLock<HashMap<usize, GuiPeer>>,
}

struct GuiPeer {
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
    pub fn new() -> Self {
        Self::Prejoin("longtest".to_string(), "blub".to_string())
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
        Self { instance, handler }
    }

    pub fn ui(&self, ui: &mut Ui) {
        for peer in self.handler.peers.write().unwrap().values_mut() {
            ui.collapsing(peer.display_name(), |ui| {
                for resource in peer.resources.values_mut() {
                    resource.ui(ui, &peer.peer)
                }
            });
        }
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
            GuiPeer {
                resources: HashMap::new(),
                peer: peer.clone(),
                username: None,
            },
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
            gp.resources.insert(
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
            gp.resources.remove(&id);
        }
        Box::pin(async move {})
    }

    fn resource_connected(
        &self,
        peer: std::sync::Arc<client_native_lib::peer::Peer>,
        resource: &client_native_lib::protocol::ProvideInfo,
        channel: client_native_lib::peer::TransportChannel,
    ) -> client_native_lib::DynFut<()> {
        if let Some(gp) = self.peers.write().unwrap().get_mut(&peer.id) {
            if let Some(gr) = gp.resources.get_mut(&resource.id) {
                *gr.state.write().unwrap() = GuiResourceState::Connected;
                match channel {
                    client_native_lib::peer::TransportChannel::Track(track) => {
                        let peer = gp.peer.clone();
                        let state = gr.state.clone();
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
        let mut guard = self.peers.write().unwrap();
        let p = guard.get_mut(&peer.id).unwrap();
        match message.clone() {
            RelayMessage::Identify { username } => p.username = Some(username),
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
    proto_ctx.register(proto).unwrap();
    mpv.playlist_load_files(&[(
        &format!("keks-meet-track://{}", rid),
        libmpv::FileState::AppendPlay,
        None,
    )])
    .unwrap();

    block_on(track.onmute(move || {
        debug!("mute");
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
