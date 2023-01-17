
.PHONY: run client-build server-run server-build watch install
build: client-build server-build
run: client-build server-run
client-build:
	make -C client-web all
server-run:
	make -C server run
server-build:
	make -C server release
watch:
	make -C client-web watch &
	make -C server watch
watch-public:
	make -C client-web watch &
	make -C server watch-public
install:
	cargo +nightly install --force --path server
	cargo +nightly install --force --path client-native-gui
	cargo +nightly install --force --path client-native-rift 
	cargo +nightly install --force --path client-native-export-track
