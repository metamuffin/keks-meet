.PHONY: all watch
all: public/assets/bundle.js public/assets/sw.js public/assets/font/include.css
watch:
	deno bundle --no-check --watch source/index.ts public/assets/bundle.js &
	deno bundle --no-check --watch source/sw/worker.ts public/assets/sw.js
public/assets/bundle.js: $(shell find source -type f -name '*.ts')
	deno bundle --no-check --unstable source/index.ts > $@
public/assets/sw.js: $(shell find source/sw -type f -name '*.ts')
	deno bundle --no-check --unstable source/sw/worker.ts > $@
public/assets/font/include.css:
	mkdir -p public/assets/font
	curl 'https://s.metamuffin.org/static/font-ubuntu.tar' | tar -xC public/assets/font
