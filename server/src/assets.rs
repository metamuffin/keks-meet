/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use log::error;
use std::sync::LazyLock;

#[cfg(debug_assertions)]
#[macro_export]
macro_rules! s_file {
    ($path: literal, $content_type: literal) => {
        warp::fs::file(concat!("../", $path))
    };
}

#[cfg(debug_assertions)]
#[macro_export]
macro_rules! s_asset_dir {
    () => {
        warp::fs::dir("../client-web/public/assets")
    };
}

#[cfg(not(debug_assertions))]
#[macro_export]
macro_rules! s_file {
    ($path: literal, $content_type: literal) => {
        warp::any().map(|| {
            warp::reply::with_header(
                include_bytes!(concat!("../../", $path)).to_vec(),
                "content-type",
                $content_type,
            )
        })
    };
}

#[cfg(not(debug_assertions))]
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

#[derive(Debug)]
struct GrassFs;
#[cfg(debug_assertions)]
impl GrassFs {
    pub fn map(p: &std::path::Path) -> std::path::PathBuf {
        std::path::PathBuf::try_from("../client-web/style")
            .unwrap()
            .join(p.file_name().unwrap())
    }
}
#[cfg(debug_assertions)]
impl grass::Fs for GrassFs {
    fn is_dir(&self, path: &std::path::Path) -> bool {
        Self::map(path).is_dir()
    }
    fn is_file(&self, path: &std::path::Path) -> bool {
        Self::map(path).is_file()
    }
    fn read(&self, path: &std::path::Path) -> std::io::Result<Vec<u8>> {
        std::fs::read(Self::map(path))
    }
}

#[cfg(not(debug_assertions))]
const STYLE_DIR: include_dir::Dir =
    include_dir::include_dir!("$CARGO_MANIFEST_DIR/../client-web/style");
#[cfg(not(debug_assertions))]
impl grass::Fs for GrassFs {
    fn is_dir(&self, _path: &std::path::Path) -> bool {
        false
    }
    fn is_file(&self, path: &std::path::Path) -> bool {
        STYLE_DIR.get_file(path.file_name().unwrap()).is_some()
    }
    fn read(&self, path: &std::path::Path) -> std::io::Result<Vec<u8>> {
        Ok(STYLE_DIR
            .get_file(path.file_name().unwrap())
            .ok_or(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "not found",
            ))?
            .contents()
            .to_vec())
    }
}

static CSS_BUNDLE: LazyLock<String> = LazyLock::new(css_bundle);

pub fn css() -> String {
    if cfg!(debug_assertions) {
        css_bundle()
    } else {
        CSS_BUNDLE.clone()
    }
}
fn css_bundle() -> String {
    grass::from_path(
        "/master.sass",
        &grass::Options::default()
            .input_syntax(grass::InputSyntax::Sass)
            .load_path("/")
            .fs(&GrassFs),
    )
    .unwrap_or_else(|err| {
        error!("sass compile failed: {err}");
        String::from("/* sass compile failed */")
    })
}
