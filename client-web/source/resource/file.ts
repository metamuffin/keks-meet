import { ebutton, ediv, espan } from "../helper.ts";
import { LocalResource, ResourceHandlerDecl } from "./mod.ts";

export const resource_file: ResourceHandlerDecl = {
    kind: "file",
    new_remote(info, user, enable) {
        return {
            info,
            el: ediv({},
                espan(`File: ${JSON.stringify(info.label)}`),
                ebutton("Download", {
                    onclick: self => {
                        enable()
                        self.disabled = true
                    }
                })
            ),
            on_statechange(_s) { },
            on_enable(channel, _disable) {
                if (!(channel instanceof RTCDataChannel)) throw new Error("not a data channel");
                channel.onopen = _ev => {
                    console.log(`${user.display_name}: channel open`);
                }
                channel.onerror = _ev => {
                    console.log(`${user.display_name}: channel error`);
                }
                channel.onclose = _ev => {
                    console.log(`${user.display_name}: channel closed`);
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
            const reader = file.stream().getReader()
            console.log(`${user.display_name} started requested file`);
            channel.onbufferedamountlow = async () => {
                const { value: chunk, done } = await reader.read()
                console.log(chunk, done);
                channel.send(chunk)
                if (!done) console.log("transfer done");
            }
            channel.onopen = _ev => {
                console.log(`${user.display_name}: channel open`);
            }
            channel.onerror = _ev => {
                console.log(`${user.display_name}: channel error`);
            }
            channel.onclose = _ev => {
                console.log(`${user.display_name}: channel closed`);
            }
            return channel
        }
    }
}