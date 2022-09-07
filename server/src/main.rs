#![feature(async_closure)]

pub mod protocol;
pub mod room;

use chashmap::CHashMap;
use hyper::StatusCode;
use listenfd::ListenFd;
use log::error;
use room::Room;
use std::convert::Infallible;
use std::sync::Arc;
use warp::hyper::Server;
use warp::{Filter, Rejection, Reply};

type Rooms = Arc<CHashMap<String, Room>>;

#[tokio::main]
async fn main() {
    env_logger::init_from_env("LOG");

    let rooms = Rooms::default();
    let rooms = warp::any().map(move || rooms.clone());

    let signaling = warp::path("signaling")
        .and(warp::path::param::<String>())
        .and(rooms)
        .and(warp::ws())
        .map(signaling_connect);

    let static_routes = {
        let index = warp::path::end().and(warp::fs::file("../client-web/public/start.html"));
        let assets = warp::path("_assets").and(warp::fs::dir("../client-web/public/assets"));

        warp::get().and(index.or(assets))
    };

    let routes = static_routes.or(signaling).recover(handle_rejection);

    // if listender fd is passed from the outside world, use it.
    let mut listenfd = ListenFd::from_env();
    let server = if let Some(l) = listenfd.take_tcp_listener(0).unwrap() {
        Server::from_tcp(l).unwrap()
    } else {
        Server::bind(&([127, 0, 0, 1], 8080).into())
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
    ws.on_upgrade(async move |sock| {
        let room = match rooms.get(&rname) {
            Some(r) => r,
            None => {
                rooms.insert(rname.to_owned(), Room::default());
                rooms.get(&rname).unwrap() // TODO never expect this to always work!!
            }
        };
        room.client_connect(sock).await;
        if room.should_remove().await {
            rooms.remove(&rname);
        }
    })
}
