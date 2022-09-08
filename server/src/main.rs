pub mod protocol;
pub mod room;

use hyper::StatusCode;
use listenfd::ListenFd;
use log::error;
use room::Room;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use warp::hyper::Server;
use warp::ws::WebSocket;
use warp::{Filter, Rejection, Reply};

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

    let rooms = Rooms::default();
    let rooms = warp::any().map(move || rooms.clone());

    let app = warp::path!(String)
        .map(|_| ())
        .untuple_one()
        .and(warp::fs::file("../client-web/public/app.html"));
    let signaling = warp::path!(String / "signaling")
        .and(rooms)
        .and(warp::ws())
        .map(signaling_connect);

    let index = warp::path!().and(warp::fs::file("../client-web/public/start.html"));
    let assets = warp::path("_assets").and(warp::fs::dir("../client-web/public/assets"));

    let routes = warp::get()
        .and(assets.or(app).or(index).or(signaling))
        .recover(handle_rejection)
        .with(warp::log("stuff"));

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
    async fn inner(sock: WebSocket, rname: String, rooms: Rooms) {
        let guard = rooms.read().await;
        let room = match guard.get(&rname) {
            Some(r) => r.to_owned(),
            None => {
                drop(guard); // make sure read-lock is dropped to avoid deadlock
                let mut guard = rooms.write().await;
                guard.insert(rname.to_owned(), Default::default());
                guard.get(&rname).unwrap().to_owned() // TODO never expect this to always work!!
            }
        };

        room.client_connect(sock).await;
        if room.should_remove().await {
            rooms.write().await.remove(&rname);
        }
    }
    ws.on_upgrade(move |sock| inner(sock, rname, rooms))
}
