import { ediv } from "../helper.ts";
import { LocalResource, ResourceHandlerDecl } from "./mod.ts";

export const resource_file: ResourceHandlerDecl = {
    kind: "file",
    new_remote(info, _user, _enable) {
        return {
            info,
            el: ediv(),
            on_statechange(_s) { },
            on_enable(_track, _disable) {
                return {
                    on_disable() {

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
            resolve({
                info: { kind: "file", id: Math.random().toString(), label: f.name, size: f.size },
                destroy() { /* TODO */ },
                el: ediv(),
                on_request(_user, _create_channel) { return _create_channel("TODO") }
            })
        })
    })
}