use crate::protocol::ClientboundPacket;
use crate::{crypto::hash, protocol::ServerboundPacket};
use futures_util::{SinkExt, StreamExt};
use log::{debug, info};
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

    let (mut tx, rx) = conn.split();

    let (in_tx, in_rx) = unbounded_channel();
    let (out_tx, mut out_rx) = unbounded_channel();

    tokio::spawn(async {
        rx.for_each(move |mesg| {
            info!("packet in");
            let mesg = mesg.unwrap();
            match mesg {
                tungstenite::Message::Text(t) => {
                    let p: ClientboundPacket = serde_json::from_str(t.as_str()).unwrap();
                    debug!("<-  {p:?}");
                    in_tx.send(p).unwrap()
                }
                tungstenite::Message::Close(_) => {
                    eprintln!("ws closed :(");
                    unreachable!();
                }
                _ => (),
            }
            Box::pin(async { () })
        })
        .await;
    });
    tokio::spawn(async move {
        while let Some(p) = out_rx.recv().await {
            debug!(" ->  {p:?}");
            tx.send(Message::Text(
                serde_json::to_string::<ServerboundPacket>(&p).unwrap(),
            ))
            .await
            .unwrap()
        }
    });

    (out_tx, in_rx)
}
