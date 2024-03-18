use crate::RequestHandler;
use bytes::Bytes;
use humansize::DECIMAL;
use libkeks::{
    peer::Peer, protocol::ProvideInfo, webrtc::data_channel::RTCDataChannel, DynFut, LocalResource,
};
use log::{debug, error, info};
use std::{
    future::Future,
    path::PathBuf,
    pin::Pin,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};
use tokio::{
    fs::{File, OpenOptions},
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::RwLock,
};

pub struct FileSender {
    pub path: Arc<PathBuf>,
    pub info: ProvideInfo,
}

impl LocalResource for FileSender {
    fn info(&self) -> ProvideInfo {
        self.info.clone()
    }

    fn on_request(&self, peer: Arc<Peer>) -> DynFut<()> {
        let id = self.info().id.clone();
        let total_size = self.info().size.unwrap_or(0);
        let path = self.path.clone();
        Box::pin(async move {
            let channel = peer
                .peer_connection
                .create_data_channel(&id, None)
                .await
                .unwrap();
            let pos = Arc::new(AtomicUsize::new(0));
            let reader: Arc<RwLock<Option<Pin<Box<dyn AsyncRead + Send + Sync>>>>> =
                Arc::new(RwLock::new(None));
            {
                let reader = reader.clone();
                let path = path.clone();
                channel.on_open(Box::new(move || {
                    let reader = reader.clone();
                    Box::pin(async move {
                        info!("channel open");
                        *reader.write().await = Some(Box::pin(File::open(&*path).await.unwrap()));
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
                let pos = pos.clone();
                let channel2 = channel.clone();
                channel
                    .on_buffered_amount_low(Box::new(move || {
                        let pos = pos.clone();
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
                                let progress_size = pos.fetch_add(size, Ordering::Relaxed);
                                info!(
                                    "sending {size} bytes ({} of {})",
                                    humansize::format_size(progress_size, DECIMAL),
                                    humansize::format_size(total_size, DECIMAL),
                                );
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

pub struct DownloadHandler {
    pub path: Option<PathBuf>,
}
impl RequestHandler for DownloadHandler {
    fn on_connect(
        &self,
        resource: ProvideInfo,
        channel: Arc<RTCDataChannel>,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + Sync>> {
        let path = self.path.clone().unwrap_or_else(|| {
            resource
                .label
                .clone()
                .unwrap_or("download".to_owned())
                .replace('/', "_")
                .replace("..", "_")
                .into()
        });
        Box::pin(async move {
            let pos = Arc::new(AtomicUsize::new(0));
            let writer: Arc<RwLock<Option<Pin<Box<dyn AsyncWrite + Send + Sync>>>>> =
                Arc::new(RwLock::new(None));
            {
                let writer = writer.clone();
                let path = path.clone();
                let channel2 = channel.clone();
                channel.on_open(Box::new(move || {
                    let path = path.clone();
                    let writer = writer.clone();
                    Box::pin(async move {
                        info!("channel opened");
                        match OpenOptions::new()
                            .write(true)
                            .read(false)
                            .create_new(true)
                            .open(path)
                            .await
                        {
                            Ok(file) => {
                                *writer.write().await = Some(Box::pin(file));
                            }
                            Err(e) => {
                                error!("cannot write download: {e}");
                                channel2.close().await.unwrap();
                            }
                        }
                    })
                }));
            }
            {
                let writer = writer.clone();
                channel.on_close(Box::new(move || {
                    let writer = writer.clone();
                    Box::pin(async move {
                        info!("channel closed");
                        *writer.write().await = None;
                    })
                }));
            }
            {
                let writer = writer.clone();
                channel.on_message(Box::new(move |mesg| {
                    let writer = writer.clone();
                    let pos = pos.clone();
                    Box::pin(async move {
                        if mesg.is_string {
                            let s = String::from_utf8(mesg.data.to_vec()).unwrap();
                            if &s == "end" {
                                info!("transfer complete")
                            }
                        } else {
                            let pos = pos.fetch_add(mesg.data.len(), Ordering::Relaxed);
                            info!(
                                "recv {:?} ({} of {})",
                                mesg.data.len(),
                                humansize::format_size(pos, DECIMAL),
                                humansize::format_size(resource.size.unwrap_or(0), DECIMAL),
                            );
                            writer
                                .write()
                                .await
                                .as_mut()
                                .unwrap()
                                .write_all(&mesg.data)
                                .await
                                .unwrap();
                        }
                    })
                }))
            }
            channel.on_error(Box::new(move |err| {
                Box::pin(async move {
                    error!("data channel errored: {err}");
                })
            }));
            Ok(())
        })
    }
}
