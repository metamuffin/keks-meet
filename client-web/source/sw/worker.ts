/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { handle_download_request, port_to_readable, streams } from "./download.ts";
import { SWMessage } from "./protocol.ts";

declare const self: ServiceWorkerGlobalScope; export { };

console.log("hello from the keks-meet service worker");
console.log(self.origin)

self.addEventListener("install", event => {
    console.log("install");
    self.skipWaiting()
    event.waitUntil(caches.delete("v1"))
})
self.addEventListener("activate", _event => {
    console.log("activate");
    self.clients.claim()
})
self.addEventListener("unload", () => {
    console.log("unload")
})

self.addEventListener("message", async ev => {
    const message: SWMessage = ev.data;
    console.log("incoming message", message);
    if (message.download) {
        const { path, size } = message.download, port = ev.ports[0]
        const readable = port_to_readable(port)
        streams.set(path, { readable, size })
    }
    if (message.check_version) {
        broadcast_response(await check_for_updates())
    }
    if (message.update) {
        broadcast_response(await update())
    }
})

async function broadcast_response(message: SWMessage) {
    const clients = await self.clients.matchAll({})
    console.log(clients);
    clients.forEach(c => c.postMessage(message))
}

self.addEventListener("fetch", async event => {
    const { request } = event;
    if (!request.url.startsWith(self.origin)) return
    const path = request.url.substring(self.origin.length)
    console.log(request.method, path);

    if (path.startsWith("/download")) return handle_download_request(path, event)
    if (path.startsWith("/signaling")) return event.respondWith(fetch(request))
    if (path == "/swtest") return event.respondWith(new Response("works!", { headers: new Headers({ "content-type": "text/plain" }) }))

    const cache = await caches.open("v1")
    // const cached = await cache.match(request)
    // if (cached) {
    //     console.log("-> cached");
    //     return cached
    // }
    console.log("-> forwarding to the server");
    const response = await fetch(request);
    cache.put(request, response.clone())
    event.respondWith(response.clone())
})


async function update(): Promise<SWMessage> {
    console.log("updating...");
    await caches.delete("v1")
    await Promise.all(
        [
            "/",
            "/room",
            "/config.json",
            "/assets/bundle.js",
            "/favicon.ico"
        ]
            .map(cache_preload)
    )
    return { updated: true }
}

async function cache_preload(path: string) {
    const cache = await caches.open("v1")
    const req = new Request(path)
    const res = await fetch(req)
    await cache.put(req, res)
}

async function check_for_updates(): Promise<SWMessage> {
    console.log("checking for updates");
    const cache = await caches.open("v1")
    const res = await fetch("/version")
    const res2 = await cache.match(new Request("/version"));
    const available_version = await res.text()
    const installed_version = res2 ? await res2.text() : "none";
    console.log({ available_version, installed_version });
    return {
        version_info: {
            available_version,
            installed_version
        }
    }
}

