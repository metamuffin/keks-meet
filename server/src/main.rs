/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
pub mod protocol;
pub mod room;

use hyper::{header, StatusCode};
use listenfd::ListenFd;
use log::{debug, error};
use room::Room;
use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use warp::hyper::Server;
use warp::ws::WebSocket;
use warp::{reply, Filter, Rejection, Reply};

type Rooms = Arc<RwLock<HashMap<String, Arc<Room>>>>;

fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run());
}

async fn run() {
    env_logger::init_from_env("LOG");

    let rooms: _ = Rooms::default();
    let rooms: _ = warp::any().map(move || rooms.clone());

    let signaling: _ = warp::path!("signaling" / String)
        .and(rooms)
        .and(warp::ws())
        .map(signaling_connect);

    let index: _ = warp::path!().and(warp::fs::file("../client-web/public/start.html"));
    let room: _ = warp::path!("room").and(warp::fs::file("../client-web/public/app.html"));
    let assets: _ = warp::path("assets").and(warp::fs::dir("../client-web/public/assets"));
    let sw_script: _ = warp::path("sw.js").and(warp::fs::file("../client-web/public/assets/sw.js"));
    let favicon: _ = warp::path!("favicon.ico").map(|| "");
    let old_format_redirect: _ = warp::path!("room" / String).map(|rname| {
        reply::with_header(
            StatusCode::MOVED_PERMANENTLY,
            header::LOCATION,
            format!("/room#{rname}?warn_redirect=true"),
        )
        .into_response()
    });

    let routes: _ = assets
        .or(room)
        .or(index)
        .or(signaling)
        .or(favicon)
        .or(sw_script)
        .or(old_format_redirect)
        .recover(handle_rejection)
        .with(warp::log("stuff"));

    // if listender fd is passed from the outside world, use it.
    let mut listenfd = ListenFd::from_env();
    let server = if let Some(l) = listenfd.take_tcp_listener(0).unwrap() {
        Server::from_tcp(l).unwrap()
    } else {
        Server::bind(
            &SocketAddr::from_str(&std::env::var("BIND").unwrap_or(String::from("127.0.0.1:8080")))
                .unwrap(),
        )
    };
    let service = warp::service(routes);
    server
        .serve(hyper::service::make_service_fn(|_| {
            let service = service.clone();
            async move { Ok::<_, Infallible>(service) }
        }))
        .await
        .unwrap();
}

async fn handle_rejection(err: Rejection) -> Result<impl Reply, Infallible> {
    let code = if err.is_not_found() {
        StatusCode::NOT_FOUND
    } else if let Some(_) = err.find::<warp::filters::body::BodyDeserializeError>() {
        StatusCode::BAD_REQUEST
    } else if let Some(_) = err.find::<warp::reject::MethodNotAllowed>() {
        StatusCode::METHOD_NOT_ALLOWED
    } else {
        error!("unhandled rejection: {:?}", err);
        StatusCode::INTERNAL_SERVER_ERROR
    };
    let json = warp::reply::html(format!(
        "<!DOCTYPE html><html><head></head><body><pre>{}</pre></body></html>",
        code.canonical_reason().unwrap_or("!?")
    ));
    Ok(warp::reply::with_status(json, code))
}

fn signaling_connect(rname: String, rooms: Rooms, ws: warp::ws::Ws) -> impl Reply {
    async fn inner(sock: WebSocket, rname: String, rooms: Rooms) {
        debug!("ws upgrade");
        let mut guard = rooms.write().await;
        let room = guard
            .entry(rname.clone())
            .or_insert_with(|| Default::default())
            .to_owned();
        drop(guard);

        room.client_connect(sock).await;
        if room.should_remove().await {
            rooms.write().await.remove(&rname);
        }
    }
    ws.on_upgrade(move |sock| inner(sock, rname, rooms))
}
