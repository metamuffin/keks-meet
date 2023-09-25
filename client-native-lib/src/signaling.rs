/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use crate::protocol::{ClientboundPacket, ServerboundPacket};
use futures_util::{Sink, SinkExt, Stream, StreamExt};
use log::{debug, error, info, trace};
use std::pin::Pin;
use tokio::sync::RwLock;
use tokio_tungstenite::tungstenite::{self, Message};

pub struct SignalingConnection {
    pub send: RwLock<
        Pin<
            Box<
                dyn Sink<ServerboundPacket, Error = tokio_tungstenite::tungstenite::Error>
                    + Send
                    + Sync
                    + 'static,
            >,
        >,
    >,
    pub recv: RwLock<Pin<Box<dyn Stream<Item = ClientboundPacket> + Send + Sync + 'static>>>,
}

impl SignalingConnection {
    pub async fn new(signaling_server: &str) -> Self {
        let uri = format!("{signaling_server}/signaling");
        info!("connecting to signaling server at {uri:?}");
        let (conn, _) = tokio_tungstenite::connect_async(url::Url::parse(&uri).unwrap())
            .await
            .unwrap();
        info!("connection established");

        let (tx, rx): (_, _) = conn.split();

        let tx = tx.with(async move |packet: ServerboundPacket| {
            match packet {
                ServerboundPacket::Relay { .. } => trace!(" ->  {packet:?}"),
                _ => debug!(" ->  {packet:?}"),
            }
            Ok::<_, _>(Message::Text(
                serde_json::to_string::<ServerboundPacket>(&packet).unwrap(),
            ))
        });

        let rx = rx.filter_map(async move |mesg| match mesg {
            Ok(mesg) => match mesg {
                tungstenite::Message::Text(t) => {
                    let packet: ClientboundPacket = serde_json::from_str(t.as_str()).unwrap();
                    match packet {
                        ClientboundPacket::Message { .. } => trace!(" <- {packet:?}"),
                        _ => debug!(" <- {packet:?}"),
                    }
                    Some(packet)
                }
                tungstenite::Message::Close(e) => {
                    error!("ws closed {e:?}");
                    None
                }
                _ => None,
            },
            Err(e) => {
                error!("websocket error: {e}");
                None
            }
        });

        Self {
            recv: RwLock::new(Box::pin(rx)),
            send: RwLock::new(Box::pin(tx)),
        }
    }
}
