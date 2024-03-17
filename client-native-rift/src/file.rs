use bytes::Bytes;
use humansize::DECIMAL;
use libkeks::{peer::Peer, protocol::ProvideInfo, DynFut, LocalResource};
use log::{debug, error, info};
use std::{
    path::PathBuf,
    pin::Pin,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};
use tokio::{
    fs::File,
    io::{AsyncRead, AsyncReadExt},
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
