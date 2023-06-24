#[cfg(not(feature = "standalone"))]
#[macro_export]
macro_rules! s_file {
    ($path: literal, $content_type: literal) => {
        warp::fs::file(concat!("../", $path))
    };
}

#[cfg(not(feature = "standalone"))]
#[macro_export]
macro_rules! s_asset_dir {
    () => {
        warp::fs::dir("../client-web/public/assets")
    };
}

#[cfg(feature = "standalone")]
#[macro_export]
macro_rules! s_file {
    ($path: literal, $content_type: literal) => {
        warp::any().map(|| {
            warp::reply::with_header(
                include_str!(concat!("../../", $path)),
                "content-type",
                $content_type,
            )
        })
    };
}

#[cfg(feature = "standalone")]
#[macro_export]
macro_rules! s_asset_dir {
    () => {{
        use include_dir::{include_dir, Dir};
        const DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../client-web/public/assets");
        warp::path::tail().and_then(|t: warp::path::Tail| async move {
            let path = t.as_str();
            let content_type = match &path {
                _ if path.ends_with(".wasm") => "application/wasm",
                _ if path.ends_with(".js") => "application/javascript",
                _ if path.ends_with(".css") => "text/css",
                _ if path.ends_with(".svg") => "image/svg+xml",
                _ => "application/octet-stream",
            };
            DIR.get_file(path)
                .map(|f| warp::reply::with_header(f.contents(), "content-type", content_type))
                .ok_or(warp::reject::not_found())
        })
    }};
}