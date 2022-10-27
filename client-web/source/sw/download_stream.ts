import { log } from "../logger.ts"
import { SW } from "./init.ts"

function FallbackStreamDownload(size: number, filename?: string, progress?: (position: number) => void) {
    log({ scope: "*", warn: true }, "downloading to memory because serviceworker is not available")
    let position = 0
    const buffer = new Uint8Array(size)
    return {
        close() {
            const a = document.createElement("a")
            a.href = URL.createObjectURL(new Blob([buffer], { type: "text/plain" }))
            a.download = filename ?? "file"
            a.click()
        },
        write(chunk: Blob) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const arr = new Uint8Array(event.target!.result as ArrayBuffer);
                for (let i = 0; i < arr.length; i++, position++) {
                    buffer[position] = arr[i]
                }
                if (progress) progress(position)
            };
            reader.readAsArrayBuffer(chunk);
        }
    }
}

export function StreamDownload(size: number, filename?: string, progress?: (position: number) => void) {
    if (!SW) FallbackStreamDownload(size, filename, progress)
    let position = 0

    const path = `/download/${encodeURIComponent(filename ?? "file")}`

    const { port1, port2 } = new MessageChannel()
    SW!.postMessage({ path, size }, [port2])

    const a = document.createElement("a")
    a.href = path
    a.download = filename ?? "file"
    a.target = "_blank"
    a.click()

    return {
        close() {
            port1.postMessage("end")
        },
        write(chunk: Blob) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const arr = new Uint8Array(event.target!.result as ArrayBuffer);
                port1.postMessage(arr)
                position += arr.length
                if (progress) progress(position)
            };
            reader.readAsArrayBuffer(chunk);
        }
    }
}
