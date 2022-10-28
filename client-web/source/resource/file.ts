/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { display_filesize, ebutton, ediv, espan, sleep } from "../helper.ts";
import { log } from "../logger.ts";
import { StreamDownload } from "../sw/download_stream.ts";
import { LocalResource, ResourceHandlerDecl } from "./mod.ts";

const MAX_CHUNK_SIZE = 1 << 15;

export const resource_file: ResourceHandlerDecl = {
    kind: "file",
    new_remote(info, user, enable) {
        const download_button = ebutton("Download", {
            onclick: self => {
                enable()
                self.textContent = "Downloading…"
                self.disabled = true
            }
        })
        return {
            info,
            el: ediv({},
                espan(`File: ${JSON.stringify(info.label)} (${display_filesize(info.size!)})`),
                download_button,
            ),
            on_statechange(_s) { },
            on_enable(channel, disable) {
                if (!(channel instanceof RTCDataChannel)) throw new Error("not a data channel");

                const display = transfer_status_el()
                this.el.appendChild(display.el)
                const reset = () => {
                    download_button.disabled = false
                    download_button.textContent = "Download again"
                    this.el.removeChild(display.el)
                    disable()
                }

                const download = StreamDownload(
                    {
                        size: info.size!,
                        filename: info.label ?? "file",
                        progress(position) {
                            display.status = `${display_filesize(position)} / ${display_filesize(info.size!)}`
                        },
                        cancel() {
                            channel.close()
                            log({ scope: "*", warn: true }, "download stream aborted")
                            reset()
                        }
                    }
                );

                let finished = false

                channel.onopen = _ev => {
                    log("dc", `${user.display_name}: channel open`);
                }
                channel.onerror = _ev => {
                    log("dc", `${user.display_name}: channel error`);
                }
                channel.onclose = _ev => {
                    log("dc", `${user.display_name}: channel closed`);
                    if (!finished) {
                        log({ warn: true, scope: "dc" }, "transfer failed");
                        download.abort()
                    } else {
                        download.close()
                    }
                    reset()
                }
                channel.onmessage = ev => {
                    const data: Blob | string = ev.data
                    if (typeof data == "string") {
                        if (data == "end") {
                            finished = true
                        }
                    } else {
                        download.write(data as Blob)
                    }
                }
            }
        }
    }
}

export function create_file_res(): Promise<LocalResource> {
    const picker = document.createElement("input")
    picker.type = "file"
    picker.click()
    return new Promise((resolve, reject) => {
        picker.addEventListener("change", () => {
            if (!picker.files) return reject()
            const f = picker.files.item(0)
            if (!f) return reject()
            resolve(file_res_inner(f))
        })
    })
}

function file_res_inner(file: File): LocalResource {
    const transfers_el = ediv({})
    const transfers_abort = new Set<() => void>()
    return {
        info: { kind: "file", id: Math.random().toString(), label: file.name, size: file.size },
        destroy() {
            transfers_abort.forEach(abort => abort())
        },
        el: ediv({ class: "file" },
            espan(`Sharing file: ${JSON.stringify(file.name)}`),
            transfers_el
        ),
        on_request(user, create_channel) {
            const channel = create_channel()
            channel.bufferedAmountLowThreshold = 1 << 16 // this appears to be the buffer size in firefox for reading files
            const reader = file.stream().getReader()

            console.log(`${user.display_name} started transfer`);
            const display = transfer_status_el()
            transfers_el.appendChild(display.el)
            display.status = "Waiting for data channel to open…"
            let position = 0

            const finish = async () => {
                channel.send("end")
                while (channel.bufferedAmount) {
                    display.status = `Draining buffers… (buffer: ${channel.bufferedAmount})`
                    await sleep(10)
                }
                display.status = "Waiting for the channel to close…"
                channel.close()
            }
            const feed = async () => {
                const { value: chunk, done }: { value?: Uint8Array, done: boolean } = await reader.read()
                if (done) return await finish()
                if (!chunk) return console.warn("no chunk");
                position += chunk.length
                // bad spec: https://www.rfc-editor.org/rfc/rfc8831#name-transferring-user-data-on-a
                // see https://github.com/webrtc-rs/webrtc/pull/304
                for (let i = 0; i < chunk.length; i += MAX_CHUNK_SIZE) {
                    channel.send(chunk.slice(i, Math.min(i + MAX_CHUNK_SIZE, chunk.length)))
                }
                display.status = `${display_filesize(position)} / ${display_filesize(file.size!)}; (buffer=${display_filesize(channel.bufferedAmount)})`
            }
            const feed_until_full = async () => {
                // this has to do with a bad browser implementation
                // https://github.com/w3c/webrtc-pc/issues/1979
                while (channel.bufferedAmount < channel.bufferedAmountLowThreshold * 2 && channel.readyState == "open") {
                    await feed()
                }
            }
            const abort_cb = () => { channel.close(); }
            channel.onbufferedamountlow = () => feed_until_full()
            channel.onopen = _ev => {
                display.status = "Buffering…"
                log("dc", `${user.display_name}: channel open`);
                feed_until_full()
            }
            channel.onerror = _ev => {
                log("dc", `${user.display_name}: channel error`);
            }
            channel.onclosing = _ev => {
                display.status = "Channel closing…"
            }
            channel.onclose = _ev => {
                log("dc", `${user.display_name}: channel closed`);
                transfers_el.removeChild(display.el)
                transfers_abort.delete(abort_cb)
            }
            transfers_abort.add(abort_cb)
            return channel
        }
    }
}

function transfer_status_el() {
    const status = espan("…")
    return {
        el: ediv({ class: "progress" }, status),
        set status(s: string) {
            status.textContent = s
        }
    }
}