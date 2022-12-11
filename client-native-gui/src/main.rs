#![feature(box_syntax)]

use async_std::task::block_on;
use client_native_lib::{
    instance::Instance,
    peer::Peer,
    protocol::{ProvideInfo, RelayMessage},
    Config, EventHandler,
};
use eframe::egui;
use egui::{Ui, Visuals};
use std::{
    collections::{HashMap, HashSet},
    ops::Deref,
    sync::{Arc, RwLock},
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

struct Ingame {
    instance: Arc<Instance>,
    handler: Arc<Handler>,
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
        for (_pid, peer) in self.handler.peers.read().unwrap().deref() {
            ui.collapsing(peer.display_name(), |ui| {
                for (_rid, resource) in peer.resources.iter() {
                    ui.label(&format!(
                        "{} {} {:?}",
                        resource.id, resource.kind, resource.label
                    ));
                    if ui.button("Request").clicked() {}
                }
            });
        }
    }
}

struct Handler {
    peers: RwLock<HashMap<usize, GuiPeer>>,
}

struct GuiPeer {
    peer: Arc<Peer>,
    resources: HashMap<String, ProvideInfo>,
    username: Option<String>,
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
            gp.resources.insert(info.id.clone(), info);
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
