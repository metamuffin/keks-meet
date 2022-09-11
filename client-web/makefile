.PHONY: all watch
all: public/assets/bundle.js
watch:
	deno bundle --no-check --watch source/index.ts public/assets/bundle.js
public/assets/bundle.js: source/*
	deno bundle --no-check --unstable source/index.ts > $@

