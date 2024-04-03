
.PHONY: run client-build server-run server-build watch install
build: client-build server-build
run: client-build server-run
install: install-server install-native
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
kill-watch:
	pkill esbuild || true
	pkill cargo || true
	pkill make || true
install-server: client-build
	cargo +nightly install --force --path server
install-native:
	cargo +nightly install --force --path client-native-gui
	cargo +nightly install --force --path client-native-rift 
	cargo +nightly install --force --path client-native-export-track

translate:
	deno run -A client-web/scripts/find_missing_translations.ts \
	| python client-web/scripts/translate_argos.py \
	| deno run client-web/scripts/reformat_json.ts

translate-deps:
	pip install argostranslate sentencepiece torch --break-system-packages
