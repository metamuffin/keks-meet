/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />
import { PO } from "./locale/mod.ts";
import { log } from "./logger.ts"
import { send_sw_message, SW_ENABLED } from "./sw/client.ts"

function FallbackStreamDownload(size: number, filename?: string, progress?: (position: number) => void) {
    log({ scope: "*", warn: true }, PO.warn_mem_download)
    let position = 0
    let buffer = new Uint8Array(size)
    return {
        close() {
            const a = document.createElement("a")
            a.href = URL.createObjectURL(new Blob([buffer], { type: "text/plain" }))
            a.download = filename ?? "file"
            a.click()
        },
        abort() { buffer = new Uint8Array(); /* have fun gc */ },
        write(chunk: ArrayBuffer) {
            const arr = new Uint8Array(chunk as ArrayBuffer);
            for (let i = 0; i < arr.length; i++, position++) {
                buffer[position] = arr[i]
            }
            if (progress) progress(position)
        }
    }
}

export function StreamDownload({ size, filename, cancel, progress }: {
    size: number,
    filename: string,
    cancel: () => void,
    progress: (position: number) => void
}) {
    if (!SW_ENABLED) return FallbackStreamDownload(size, filename, progress)
    let position = 0

    // the sw will handle this download
    const path = `/download/${encodeURIComponent(filename ?? "file")}`

    const { port1, port2 } = new MessageChannel()
    send_sw_message({ download: { path, size } }, [port2])

    const a = document.createElement("a")
    a.href = path
    a.download = filename ?? "file"
    a.target = "_blank"
    // TODO this delay is part of a race condition btw
    setTimeout(() => {
        a.click()
    }, 100)

    port1.onmessage = ev => {
        if (ev.data.abort) {
            cancel()
            port1.close()
        }
    }

    return {
        close() {
            port1.postMessage("end")
        },
        abort() {
            port1.postMessage("abort")
        },
        write(chunk: ArrayBuffer) {
            const arr = new Uint8Array(chunk);
            port1.postMessage(arr)
            position += arr.length
            if (progress) progress(position)
        }
    }
}
