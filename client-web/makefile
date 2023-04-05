ESFLAGS = --bundle --target=esnext --format=esm

.PHONY: all watch
all: public/assets/bundle.js public/assets/sw.js public/assets/font/include.css
watch:
	esbuild $(ESFLAGS) source/index.ts --outfile=public/assets/bundle.js --watch=forever &
	esbuild $(ESFLAGS) source/sw/worker.ts --outfile=public/assets/sw.js --watch=forever
public/assets/bundle.js: $(shell find source -type f -name '*.ts')
	esbuild $(ESFLAGS) source/index.ts --outfile=$@
public/assets/sw.js: $(shell find source/sw -type f -name '*.ts')
	esbuild $(ESFLAGS) source/sw/worker.ts --outfile=$@
public/assets/font/include.css:
	mkdir -p public/assets/font
	curl 'https://s.metamuffin.org/static/font-ubuntu.tar' | tar -xC public/assets/font
