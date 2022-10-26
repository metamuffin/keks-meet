/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference no-default-lib="true"/>

/// <reference lib="esnext" />
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope; export { };

console.log("hello from the keks-meet service worker");
console.log(self.origin)

// let cache: Cache;

self.addEventListener("install", event => {
    console.log("install");
    self.skipWaiting()
    event.waitUntil(caches.delete("v1"))
})
self.addEventListener("activate", _event => {
    console.log("activate");
    self.clients.claim()
    // event.waitUntil((async () => {
    //     cache = await caches.open("v1")
    //     cache.addAll([
    //         "/assets/bundle.js",
    //         "/assets/sw.js",
    //     ])
    // })())
})
self.addEventListener("unload", () => {
    console.log("unload")
})

const streams = new Map<string, { readable: ReadableStream, size: number }>()

self.addEventListener("message", ev => {
    console.log(ev);
    const { path, size } = ev.data, port = ev.ports[0]
    const readable = port_to_readable(port)
    streams.set(path, { readable, size })
})

function port_to_readable(port: MessagePort): ReadableStream {
    return new ReadableStream({
        start(controller) {
            console.log("ReadableStream started");
            port.onmessage = event => {
                if (event.data === "end") { controller.close() }
                else if (event.data === "abort") controller.error("aborted")
                else controller.enqueue(event.data)
            }
        },
        cancel() { console.log("ReadableStream cancelled"); port.postMessage({ abort: true }) },
    })
}

self.addEventListener("fetch", event => {
    const { request } = event;
    if (!request.url.startsWith(self.origin)) return
    const path = request.url.substring(self.origin.length)
    console.log(request.method, path);

    const stream = streams.get(path)
    if (stream) {
        streams.delete(path)
        console.log(`-> stream response`);
        return event.respondWith(
            new Response(
                stream.readable,
                {
                    headers: new Headers({
                        "Content-Type": "application/octet-stream; charset=utf-8", // TODO transmit and set accordingly
                        "Content-Security-Policy": "default-src 'none'",
                        "Content-Length": `${stream.size}`,
                    })
                }
            )
        )
    }

    event.respondWith(fetch(request))
})
