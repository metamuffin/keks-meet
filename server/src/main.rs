/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
pub mod assets;
pub mod config;
pub mod protocol;
pub mod room;

use assets::css_bundle;
use config::{ClientAppearanceConfig, ClientConfig};
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

    let client_config: ClientConfig = toml::from_str(include_str!("../../config/client.toml"))
        .expect("client configuration invalid");
    let client_config_json = serde_json::to_string(&client_config).unwrap();
    let client_config_css = css_overrides(&client_config.appearance);

    let rooms: _ = Rooms::default();
    let rooms: _ = warp::any().map(move || rooms.clone());

    let signaling: _ = warp::path!("signaling" / String)
        .and(rooms)
        .and(warp::ws())
        .map(signaling_connect);

    // TODO add cache policy headers

    let index: _ = warp::path!().and(s_file!("client-web/public/start.html", "text/html"));
    let room: _ = warp::path!("room").and(s_file!("client-web/public/app.html", "text/html"));
    let assets: _ = warp::path("assets").and(s_asset_dir!());
    let sw_script: _ = warp::path("sw.js").and(s_file!(
        "client-web/public/assets/sw.js",
        "application/javascript"
    ));
    let client_config: _ = warp::path!("config.json").map(move || {
        warp::reply::with_header(
            client_config_json.clone(),
            "content-type",
            "application/json",
        )
    });
    let client_config_css: _ = warp::path!("overrides.css").map(move || {
        warp::reply::with_header(client_config_css.clone(), "content-type", "text/css")
    });
    let css: _ = warp::path!("style.css")
        .map(move || warp::reply::with_header(css_bundle(), "content-type", "text/css"));
    let favicon: _ = warp::path!("favicon.ico").map(|| "");
    let old_format_redirect: _ = warp::path!("room" / String).map(|rsecret| {
        reply::with_header(
            StatusCode::MOVED_PERMANENTLY,
            header::LOCATION,
            format!("/room#{rsecret}?warn_redirect=true"),
        )
        .into_response()
    });
    let version: _ = warp::path!("version").map(|| env!("CARGO_PKG_VERSION"));

    let routes: _ = assets
        .or(room)
        .or(index)
        .or(signaling)
        .or(client_config)
        .or(version)
        .or(css)
        .or(favicon)
        .or(sw_script)
        .or(old_format_redirect)
        .or(client_config_css)
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

fn signaling_connect(rsecret: String, rooms: Rooms, ws: warp::ws::Ws) -> impl Reply {
    async fn inner(sock: WebSocket, rsecret: String, rooms: Rooms) {
        debug!("ws upgrade");
        let mut guard = rooms.write().await;
        let room = guard
            .entry(rsecret.clone())
            .or_insert_with(|| Default::default())
            .to_owned();
        drop(guard);

        room.client_connect(sock).await;
        if room.should_remove().await {
            rooms.write().await.remove(&rsecret);
        }
    }
    ws.on_upgrade(move |sock| inner(sock, rsecret, rooms))
}

fn css_overrides(
    ClientAppearanceConfig {
        accent,
        accent_light,
        accent_dark,
        background,
        background_dark,
    }: &ClientAppearanceConfig,
) -> String {
    format!(
        r#":root {{
    --bg: {background};
    --bg-dark: {background_dark};
    --ac: {accent};
    --ac-dark: {accent_dark};
    --ac-dark-transparent: {accent_dark}c9;
    --ac-light: {accent_light};
}}
"#
    )
}
