use crate::RequestHandler;
use bytes::Bytes;
use libkeks::{
    peer::Peer, protocol::ProvideInfo, webrtc::data_channel::RTCDataChannel, DynFut, LocalResource,
};
use log::{debug, error, info, warn};
use std::{future::Future, pin::Pin, sync::Arc};
use tokio::{
    io::{AsyncReadExt, AsyncWrite, AsyncWriteExt},
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
            let writer: Arc<RwLock<Option<Pin<Box<dyn AsyncWrite + Send + Sync>>>>> =
                Arc::new(RwLock::new(None));
            {
                let writer = writer.clone();
                let channel2 = channel.clone();
                channel.on_open(Box::new(move || {
                    let writer = writer.clone();
                    Box::pin(async move {
                        info!("channel open");
                        match TcpStream::connect(("127.0.0.1", port)).await {
                            Ok(stream) => {
                                let (mut read, write) = stream.into_split();
                                *writer.write().await = Some(Box::pin(write));
                                let channel = channel2.clone();
                                tokio::task::spawn(async move {
                                    let mut buf = [0u8; 1 << 15];
                                    loop {
                                        let Ok(size) = read.read(&mut buf).await else {
                                            break;
                                        };
                                        if size == 0 {
                                            break;
                                        }
                                        debug!("send {size}");
                                        channel
                                            .send(&Bytes::copy_from_slice(&buf[..size]))
                                            .await
                                            .unwrap();
                                    }
                                });
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
                let writer = writer.clone();
                channel.on_close(Box::new(move || {
                    let writer = writer.clone();
                    Box::pin(async move {
                        info!("channel closed");
                        *writer.write().await = None;
                    })
                }))
            }
            {
                let writer = writer.clone();
                channel.on_message(Box::new(move |message| {
                    let writer = writer.clone();
                    Box::pin(async move {
                        debug!("recv {}", message.data.len());
                        writer
                            .write()
                            .await
                            .as_mut()
                            .unwrap()
                            .write_all(&message.data)
                            .await
                            .unwrap();
                    })
                }));
            }
            channel.on_error(Box::new(move |err| {
                Box::pin(async move { error!("channel error: {err}") })
            }))
        })
    }
}

pub struct ForwardHandler {
    pub stream: Arc<RwLock<Option<TcpStream>>>,
}
impl RequestHandler for ForwardHandler {
    fn on_connect(
        &self,
        _resource: ProvideInfo,
        channel: Arc<RTCDataChannel>,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + Sync>> {
        let stream = self.stream.clone();
        Box::pin(async move {
            let stream = stream.write().await.take().unwrap();
            let (mut read, write) = stream.into_split();
            let write = Arc::new(RwLock::new(write));

            let channel2 = channel.clone();
            channel.on_open(Box::new(move || {
                Box::pin(async move {
                    info!("channel open");
                    let channel = channel2.clone();
                    tokio::task::spawn(async move {
                        let mut buf = [0u8; 1 << 15];
                        loop {
                            let Ok(size) = read.read(&mut buf).await else {
                                break;
                            };
                            if size == 0 {
                                break;
                            }
                            debug!("send {size}");
                            channel
                                .send(&Bytes::copy_from_slice(&buf[..size]))
                                .await
                                .unwrap();
                        }
                    });
                })
            }));
            channel.on_close(Box::new(move || {
                Box::pin(async move {
                    info!("channel closed");
                })
            }));
            channel.on_error(Box::new(move |err| {
                Box::pin(async move { error!("channel error: {err}") })
            }));
            {
                let write = write.clone();
                channel.on_message(Box::new(move |message| {
                    let write = write.clone();
                    Box::pin(async move {
                        debug!("recv {}", message.data.len());
                        write.write().await.write_all(&message.data).await.unwrap();
                    })
                }));
            }

            Ok(())
        })
    }
}
