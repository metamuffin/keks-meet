# makefile is stupid but helps with installation
.PHONY: release run watch
release: target/release/keks-meet
run: 
	cargo +stable run --release
watch:
	systemfd --no-pid -s http::8080 -- cargo watch -x '+stable run'
target/release/keks-meet: $(shell find src) Cargo.toml
	cargo +stable build --release
