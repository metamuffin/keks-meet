use crate::file::{DownloadHandler, FileSender};
use crate::port::{ForwardHandler, PortExposer};
use crate::{Command, State};
use anyhow::bail;
use libkeks::{
    instance::Instance,
    peer::Peer,
    protocol::{ChatMesssage, ProvideInfo, RelayMessage},
};
use log::{debug, error, info};
use std::{os::unix::prelude::MetadataExt, sync::Arc};
use tokio::{fs, net::TcpListener, sync::RwLock};

pub(crate) async fn dispatch_command(
    inst: &Arc<Instance>,
    state: &Arc<RwLock<State>>,
    command: Command,
) -> anyhow::Result<()> {
    match command {
        Command::List => {
            let peers = inst.peers.read().await;
            for p in peers.values() {
                let username = p
                    .username
                    .read()
                    .await
                    .clone()
                    .unwrap_or("<unknown>".to_string());
                info!("{username}:");
                for (rid, r) in p.remote_provided.read().await.iter() {
                    info!(
                        "\t{rid:?}: {} {:?}",
                        r.kind,
                        r.label.clone().unwrap_or_default()
                    )
                }
            }
        }
        Command::Stop { mut ids } => {
            if ids.is_empty() {
                ids = inst
                    .local_resources
                    .read()
                    .await
                    .keys()
                    .cloned()
                    .collect::<Vec<_>>();
            }
            for id in ids {
                if !inst.remove_local_resource(id.clone()).await {
                    bail!("service {id:?} not found.")
                }
            }
        }
        Command::Provide { path, id } => {
            inst.add_local_resource(Box::new(FileSender {
                info: ProvideInfo {
                    id: id.unwrap_or("file".to_owned()),
                    kind: "file".to_string(),
                    track_kind: None,
                    label: Some(path.file_name().unwrap().to_str().unwrap().to_string()),
                    size: Some(fs::metadata(&path).await?.size() as usize),
                },
                path: path.into(),
            }))
            .await;
        }
        Command::Download { id, path } => {
            let (peer, _resource) = find_id(inst, id.clone(), "file").await?;
            state
                .write()
                .await
                .requested
                .insert(id.clone(), Box::new(DownloadHandler { path }));
            peer.request_resource(id).await;
        }
        Command::Expose { port, id } => {
            inst.add_local_resource(Box::new(PortExposer {
                port,
                info: ProvideInfo {
                    kind: "port".to_string(),
                    id: id.unwrap_or(format!("p{port}")),
                    track_kind: None,
                    label: Some(format!("port {port}")),
                    size: None,
                },
            }))
            .await;
        }
        Command::Forward { id, port } => {
            let (peer, _resource) = find_id(inst, id.clone(), "port").await?;
            let state = state.clone();
            tokio::task::spawn(async move {
                let Ok(listener) = TcpListener::bind(("127.0.0.1", port.unwrap_or(0))).await else {
                    error!("cannot bind tcp listener");
                    return;
                };
                info!("tcp listener bound to {}", listener.local_addr().unwrap());
                while let Ok((stream, addr)) = listener.accept().await {
                    debug!("new connection from {addr:?}");
                    state.write().await.requested.insert(
                        id.clone(),
                        Box::new(ForwardHandler {
                            stream: Arc::new(RwLock::new(Some(stream))),
                        }),
                    );
                    peer.request_resource(id.clone()).await;
                }
            });
        }
        Command::Chat { message } => {
            inst.send_relay(None, RelayMessage::Chat(ChatMesssage::Text(message)))
                .await;
        }
    }
    Ok(())
}

async fn find_id(
    inst: &Arc<Instance>,
    id: String,
    kind: &str,
) -> anyhow::Result<(Arc<Peer>, ProvideInfo)> {
    let peers = inst.peers.read().await;
    for peer in peers.values() {
        for (rid, r) in peer.remote_provided.read().await.iter() {
            if rid == &id {
                if r.kind == kind {
                    return Ok((peer.to_owned(), r.to_owned()));
                } else {
                    bail!("wrong type: expected {kind:?}, found {:?}", r.kind)
                }
            }
        }
    }
    bail!("id not found")
}
