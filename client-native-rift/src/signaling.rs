use crate::protocol::ClientboundPacket;
use crate::{crypto::hash, protocol::ServerboundPacket};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::{self, Message};

pub async fn signaling_connect(
    host: &str,
    secret: &str,
) -> (
    impl SinkExt<ServerboundPacket>,
    impl StreamExt<Item = Option<ClientboundPacket>>,
) {
    let (conn, _) = tokio_tungstenite::connect_async(
        url::Url::parse(&format!("wss://{host}/signaling/{}", hash(secret))).unwrap(),
    )
    .await
    .unwrap();

    let (tx, rx) = conn.split();
    let prx = rx.map(|mesg| {
        let mesg = mesg.unwrap();
        match mesg {
            tungstenite::Message::Text(t) => {
                let p: ClientboundPacket = serde_json::from_str(t.as_str()).unwrap();
                Some(p)
            }
            tungstenite::Message::Close(_) => {
                eprintln!("ws closed :(");
                None
            }
            _ => None,
        }
    });
    let ptx = tx.with(async move |p| {
        Ok::<_, tokio_tungstenite::tungstenite::error::Error>(Message::Text(
            serde_json::to_string::<ServerboundPacket>(&p).unwrap(),
        ))
    });
    (ptx, prx)
}
