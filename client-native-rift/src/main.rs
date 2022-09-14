use clap::{Parser, Subcommand};
use log::error;

fn main() {
    env_logger::init_from_env("LOG");
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run())
}

#[derive(Parser)]
pub struct Args {
    #[clap(long, default_value = "meet.metamuffin.org")]
    signaling_host: String,
    #[clap(short, long)]
    secret: String,
    #[clap(subcommand)]
    action: Action,
}
#[derive(Subcommand)]
pub enum Action {
    Send {},
    Receive {},
}

async fn run() {
    tokio::signal::ctrl_c().await.unwrap();
    error!("interrupt received, exiting");
}
