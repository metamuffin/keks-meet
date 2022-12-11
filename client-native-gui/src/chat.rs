use crate::GuiPeer;
use async_std::task::block_on;
use client_native_lib::{
    instance::Instance,
    protocol::{ChatMesssage, RelayMessage},
};
use egui::{Key, ScrollArea, TextEdit, Ui};
use std::{
    collections::VecDeque,
    sync::{Arc, RwLock},
};

pub struct Chat {
    instance: Arc<Instance>,
    input_line: String,
    pub history: VecDeque<(Option<Arc<RwLock<GuiPeer>>>, ChatMesssage)>,
}

impl Chat {
    pub fn new(instance: Arc<Instance>) -> Self {
        Chat {
            instance,
            input_line: "".into(),
            history: VecDeque::new(),
        }
    }
    pub fn ui(&mut self, ui: &mut Ui) {
        ScrollArea::vertical().id_source("chat").show(ui, |ui| {
            ui.label("this is the chat!");
            for (sender, message) in &self.history {
                let sender = sender
                    .as_ref()
                    .map(|s| s.read().unwrap().display_name())
                    .unwrap_or(String::from("Me"));
                match message {
                    ChatMesssage::Text(s) => {
                        ui.label(&format!("{}: {}", sender, s));
                    }
                    ChatMesssage::Image(_) => {
                        ui.label("<image here>");
                    }
                };
            }
            let r = TextEdit::singleline(&mut self.input_line).show(ui).response;
            if r.lost_focus() && r.ctx.input().key_down(Key::Enter) {
                self.send(ChatMesssage::Text(self.input_line.to_owned()));
                self.input_line = "".into();
                r.request_focus();
            }
        });
    }
    pub fn add(&mut self, sender: Option<Arc<RwLock<GuiPeer>>>, message: ChatMesssage) {
        self.history.push_back((sender, message));
    }
    pub fn send(&mut self, message: ChatMesssage) {
        self.add(None, message.clone());
        block_on(self.instance.send_relay(None, RelayMessage::Chat(message)));
    }
}
