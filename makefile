
.PHONY: run client-build server-run server-build watch
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
