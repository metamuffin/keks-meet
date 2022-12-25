
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
	cargo install --path server
	cargo install --path client-native-gui
	cargo install --path client-native-rift 
	cargo install --path client-native-export-track
