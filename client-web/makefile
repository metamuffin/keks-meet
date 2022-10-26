.PHONY: all watch
all: public/assets/bundle.js public/assets/sw.js
watch:
	deno bundle --no-check --watch source/index.ts public/assets/bundle.js &
	deno bundle --no-check --watch source/sw/worker.ts public/assets/sw.js
public/assets/bundle.js: $(shell find source -type f -name '*.ts')
	deno bundle --no-check --unstable source/index.ts > $@
public/assets/sw.js: $(shell find source/sw -type f -name '*.ts')
	deno bundle --no-check --unstable source/sw/worker.ts > $@
