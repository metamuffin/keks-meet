use bytes::Bytes;
use libkeks::{peer::Peer, protocol::ProvideInfo, DynFut, LocalResource};
use log::{debug, error, info, warn};
use std::{pin::Pin, sync::Arc};
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    net::TcpStream,
    sync::RwLock,
};

pub struct PortExposer {
    pub port: u16,
    pub info: ProvideInfo,
}

impl LocalResource for PortExposer {
    fn info(&self) -> ProvideInfo {
        self.info.clone()
    }

    fn on_request(&self, peer: Arc<Peer>) -> DynFut<()> {
        let id = self.info().id.clone();
        let port = self.port;
        Box::pin(async move {
            let channel = peer
                .peer_connection
                .create_data_channel(&id, None)
                .await
                .unwrap();
            let reader: Arc<RwLock<Option<Pin<Box<dyn AsyncRead + Send + Sync>>>>> =
                Arc::new(RwLock::new(None));
            {
                let reader = reader.clone();
                let channel2 = channel.clone();
                channel.on_open(Box::new(move || {
                    let reader = reader.clone();
                    Box::pin(async move {
                        info!("channel open");
                        match TcpStream::connect(("127.0.0.1", port)).await {
                            Ok(stream) => {
                                *reader.write().await = Some(Box::pin(stream));
                            }
                            Err(e) => {
                                warn!("upstream connect failed: {e}");
                                channel2.close().await.unwrap();
                            }
                        }
                    })
                }))
            }
            {
                let reader = reader.clone();
                channel.on_close(Box::new(move || {
                    let reader = reader.clone();
                    Box::pin(async move {
                        info!("channel closed");
                        *reader.write().await = None;
                    })
                }))
            }
            {
                let reader = reader.clone();
                let channel2 = channel.clone();
                channel
                    .on_buffered_amount_low(Box::new(move || {
                        let reader = reader.clone();
                        let channel = channel2.clone();
                        Box::pin(async move {
                            debug!("buffered amount low");
                            let mut buf = [0u8; 1 << 15];
                            let size = reader
                                .write()
                                .await
                                .as_mut()
                                .unwrap()
                                .read(&mut buf)
                                .await
                                .unwrap();
                            if size == 0 {
                                info!("reached EOF, closing channel");
                                let _ = channel.send_text("end").await;
                                channel.close().await.unwrap();
                            } else {
                                channel
                                    .send(&Bytes::copy_from_slice(&buf[..size]))
                                    .await
                                    .unwrap();
                            }
                        })
                    }))
                    .await;
                channel.set_buffered_amount_low_threshold(1).await;
            }
            channel.on_error(Box::new(move |err| {
                Box::pin(async move { error!("channel error: {err}") })
            }))
        })
    }
}
