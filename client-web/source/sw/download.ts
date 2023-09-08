/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
export const streams = new Map<string, { readable: ReadableStream, size: number }>()

export function handle_download_request(path: string, event: FetchEvent) {
    const stream = streams.get(path)
    if (stream) {
        streams.delete(path)
        console.log(`-> stream response`);
        event.respondWith(
            new Response(
                stream.readable,
                {
                    headers: new Headers({
                        "content-type": "application/octet-stream; charset=utf-8", // TODO transmit and set accordingly
                        "content-security-policy": "default-src 'none'",
                        "content-length": `${stream.size}`,
                    })
                }
            )
        )
    }
    event.respondWith(new Response("download failed", { status: 400, headers: new Headers({ "content-type": "text/plain" }) }))
}

export function port_to_readable(port: MessagePort): ReadableStream {
    return new ReadableStream({
        start(controller) {
            console.log("ReadableStream started");
            port.onmessage = event => {
                if (event.data === "end") controller.close()
                else if (event.data === "abort") controller.error("aborted")
                else controller.enqueue(event.data)
            }
        },
        cancel() { console.log("ReadableStream cancelled"); port.postMessage({ abort: true }) },
    })
}
