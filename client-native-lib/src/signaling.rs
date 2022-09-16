/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
use std::time::Duration;

use crate::protocol::ClientboundPacket;
use crate::{crypto::hash, protocol::ServerboundPacket};
use futures_util::{SinkExt, StreamExt};
use log::{debug, error, info, warn};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_tungstenite::tungstenite::{self, Message};

pub async fn signaling_connect(
    host: &str,
    secret: &str,
) -> (
    UnboundedSender<ServerboundPacket>,
    UnboundedReceiver<ClientboundPacket>,
) {
    let uri = format!("wss://{host}/signaling/{}", hash(secret));
    info!("connecting to signaling server at {uri:?}");
    let (conn, _) = tokio_tungstenite::connect_async(url::Url::parse(&uri).unwrap())
        .await
        .unwrap();
    info!("connection established");

    let (mut tx, mut rx) = conn.split();

    let (in_tx, in_rx) = unbounded_channel();
    let (out_tx, mut out_rx) = unbounded_channel();

    let ping_out_tx = out_tx.clone();
    let ping_task = tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(30)).await;
            ping_out_tx.send(ServerboundPacket::Ping).unwrap()
        }
    });

    let send_task = tokio::spawn(async move {
        while let Some(p) = out_rx.recv().await {
            debug!(" ->  {p:?}");
            tx.send(Message::Text(
                serde_json::to_string::<ServerboundPacket>(&p).unwrap(),
            ))
            .await
            .unwrap();
        }
    });
    let _receive_task = tokio::spawn(async move {
        while let Some(mesg) = rx.next().await {
            match mesg {
                Ok(mesg) => match mesg {
                    tungstenite::Message::Text(t) => {
                        let p: ClientboundPacket = serde_json::from_str(t.as_str()).unwrap();
                        debug!("<-  {p:?}");
                        in_tx.send(p).unwrap()
                    }
                    tungstenite::Message::Close(e) => {
                        error!("ws closed :( {e:?}");
                        unreachable!();
                    }
                    _ => (),
                },
                Err(_) => {
                    send_task.abort();
                    ping_task.abort();
                    break;
                }
            }
        }
        warn!("recv task stopped");
    });

    (out_tx, in_rx)
}
