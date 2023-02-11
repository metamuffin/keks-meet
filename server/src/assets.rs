#[cfg(not(feature = "standalone"))]
#[macro_export]
macro_rules! s_file {
    ($path: literal) => {
        warp::fs::file($path)
    };
}

#[cfg(not(feature = "standalone"))]
#[macro_export]
macro_rules! s_asset_dir {
    () => {
        warp::fs::dir("client-web/public/assets")
    };
}

#[cfg(feature = "standalone")]
#[macro_export]
macro_rules! s_file {
    ($path: literal) => {
        warp::get().map(|| include_str!(concat!("../../", $path)))
    };
}

#[cfg(feature = "standalone")]
#[macro_export]
macro_rules! s_asset_dir {
    () => {{
        use include_dir::{include_dir, Dir};
        const DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../client-web/public/assets");
        warp::path::tail().and_then(|t: warp::path::Tail| async move {
            DIR.get_file(t.as_str())
                .map(|f| f.contents_utf8().unwrap())
                .ok_or(warp::reject::not_found())
        })
    }};
}
