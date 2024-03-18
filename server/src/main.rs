/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
#![feature(lazy_cell)]
pub mod assets;
pub mod config;
pub mod idgen;
pub mod logic;
pub mod protocol;

use crate::protocol::ClientboundPacket;
use assets::css;
use config::{AppearanceConfig, Config};
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use listenfd::ListenFd;
use log::{debug, error, warn};
use logic::State;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use warp::http::StatusCode;
use warp::{
    reply,
    ws::{Message, WebSocket},
    Filter, Rejection, Reply,
};

fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run());
}

async fn run() {
    env_logger::init_from_env("LOG");

    #[cfg(feature = "embed_config")]
    let config = include_str!("../../config/config.toml").to_string();
    #[cfg(not(feature = "embed_config"))]
    let config = std::fs::read_to_string(
        std::env::args()
            .nth(1)
            .expect("first argument should be the configuration"),
    )
    .expect("cannot read configuration");
    let config: Config = toml::from_str(&config).expect("configuration invalid");
    let client_config_json = serde_json::to_string(&config).unwrap();
    let client_config_css = css_overrides(&config.appearance);

    let state: _ = Arc::new(State::default());
    let state: _ = warp::any().map(move || state.clone());

    let signaling: _ = warp::path!("signaling")
        .and(state)
        .and(warp::ws())
        .map(signaling_connect);

    let index: _ = warp::path!().and(s_file!("client-web/public/start.html", "text/html"));
    let favicon: _ =
        warp::path!("favicon.ico").and(s_file!("client-web/public/favicon.ico", "image/avif"));
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
        .map(move || warp::reply::with_header(css(), "content-type", "text/css"));
    let old_format_redirect: _ = warp::path!("room" / String).map(|rsecret| {
        reply::with_header(
            StatusCode::MOVED_PERMANENTLY,
            "location",
            format!("/room#{rsecret}?warn_redirect=true"),
        )
        .into_response()
    });
    let version: _ = warp::path!("version").map(|| env!("CARGO_PKG_VERSION"));

    let routes: _ = signaling
        .or(assets
            .or(room)
            .or(index)
            .or(client_config)
            .or(version)
            .or(css)
            .or(favicon)
            .or(sw_script)
            .or(old_format_redirect)
            .or(client_config_css)
            .map(|r| {
                warp::reply::with_header(
                    r,
                    "cache-control",
                    if cfg!(debug_assertions) {
                        "no-cache"
                    } else {
                        "max-age=1000000"
                    },
                )
            }))
        .recover(handle_rejection)
        .with(warp::log("keks-meet"))
        .map(|r| warp::reply::with_header(r, "server", "keks-meet"));

    // if listender fd is passed from the outside world, use it.
    let mut listenfd = ListenFd::from_env();
    if let Some(l) = listenfd.take_tcp_listener(0).unwrap() {
        l.set_nonblocking(true).unwrap();
        let l = TcpListener::from_std(l).unwrap();
        warp::serve(routes)
            .run_incoming(async_stream::stream! {
                loop {
                    yield l.accept().await.map(|(conn,_addr)| conn);
                }
            })
            .await;
    } else {
        warp::serve(routes).run(config.server.bind).await;
    };
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

fn signaling_connect(state: Arc<State>, ws: warp::ws::Ws) -> impl Reply {
    async fn inner(sock: WebSocket, state: Arc<State>) {
        debug!("ws upgrade");
        let (mut user_ws_tx, user_ws_rx) = sock.split();
        let (tx, mut rx) = mpsc::channel::<ClientboundPacket>(64);
        tokio::task::spawn(async move {
            while let Some(packet) = rx.recv().await {
                debug!(" -> {packet:?}");
                user_ws_tx
                    .send(Message::text(serde_json::to_string(&packet).unwrap()))
                    .unwrap_or_else(|e| {
                        warn!("websocket send error: {}", e);
                    })
                    .await;
            }
        });
        state.connect(user_ws_rx, tx).await;
    }
    ws.on_upgrade(move |sock| inner(sock, state))
}

fn css_overrides(
    AppearanceConfig {
        accent,
        accent_light,
        accent_dark,
        background,
        background_dark,
        background_light,
    }: &AppearanceConfig,
) -> String {
    format!(
        r#":root {{
--bg: {background};
--bg-dark: {background_dark};
--bg-light: {background_light};
--ac: {accent};
--ac-dark: {accent_dark};
--ac-dark-transparent: {accent_dark}c9;
--ac-light: {accent_light};
}}
"#
    )
}
