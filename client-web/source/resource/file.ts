/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ebutton, ediv, espan, sleep } from "../helper.ts";
import { log } from "../logger.ts";
import { LocalResource, ResourceHandlerDecl } from "./mod.ts";

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
                espan(`File: ${JSON.stringify(info.label)}`),
                download_button,
            ),
            on_statechange(_s) { },
            on_enable(channel, disable) {
                if (!(channel instanceof RTCDataChannel)) throw new Error("not a data channel");
                // TODO stream
                let position = 0
                const buffer = new Uint8Array(info.size!)

                const display = transfer_status_el()
                this.el.appendChild(display.el)

                channel.onopen = _ev => {
                    log("dc", `${user.display_name}: channel open`);
                }
                channel.onerror = _ev => {
                    log("dc", `${user.display_name}: channel error`);
                }
                channel.onclose = _ev => {
                    log("dc", `${user.display_name}: channel closed`);
                    const a = document.createElement("a")
                    a.href = URL.createObjectURL(new Blob([buffer], { type: "text/plain" }))
                    a.download = info.label ?? "file"
                    a.click()
                    this.el.removeChild(display.el)
                    download_button.disabled = false
                    download_button.textContent = "Download"
                    disable()
                }
                channel.onmessage = ev => {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        const arr = new Uint8Array(event.target!.result as ArrayBuffer);
                        for (let i = 0; i < arr.length; i++, position++) {
                            buffer[position] = arr[i]
                        }
                        display.status = `${position} / ${info.size}`
                    };
                    reader.readAsArrayBuffer(ev.data);
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
    return {
        info: { kind: "file", id: Math.random().toString(), label: file.name, size: file.size },
        destroy() { },
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
                while (channel.bufferedAmount) {
                    display.status = `Draining buffers… (buffer: ${channel.bufferedAmount})`
                    await sleep(10)
                }
                display.status = "Waiting for the channel to close…"
                return channel.close()
            }
            const feed = async () => {
                const { value: chunk, done } = await reader.read()
                if (done) return await finish()
                if (!chunk) console.warn("no chunk");
                position += chunk.length
                channel.send(chunk)
                display.status = `${position} / ${file.size} (buffer: ${channel.bufferedAmount})`
            }
            const feed_until_full = async () => {
                // this has to do with a bad browser implementation
                // https://github.com/w3c/webrtc-pc/issues/1979
                while (channel.bufferedAmount < channel.bufferedAmountLowThreshold * 2 && channel.readyState == "open") {
                    await feed()
                }
            }
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
            }
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