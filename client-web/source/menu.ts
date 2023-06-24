/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ebutton, ediv, efooter, einput, elabel, enav, ep } from "./helper.ts"
import { VERSION } from "./index.ts"
import { ui_preferences } from "./preferences/ui.ts"
import { create_file_res } from "./resource/file.ts";
import { create_camera_res, create_mic_res, create_screencast_res } from "./resource/track.ts";
import { Room } from "./room.ts"

export function info_br() {
    const item = (name: string, cb: (() => void) | string) => {
        const p = document.createElement("p")
        const a = document.createElement("a")
        a.classList.add("menu-item")
        a.target = "_blank" // dont unload this meeting
        a.textContent = name
        if (typeof cb == "string") a.href = cb
        else a.addEventListener("click", cb), a.href = "#"
        p.append(a)
        return p
    }

    return efooter({ class: "info-br" },
        ep(`keks-meet ${VERSION}`, { class: "version" }),
        item("License", "https://codeberg.org/metamuffin/keks-meet/raw/branch/master/COPYING"),
        item("Source code", "https://codeberg.org/metamuffin/keks-meet"),
        item("Documentation", "https://codeberg.org/metamuffin/keks-meet/src/branch/master/readme.md"),
    )
}


export function control_bar(room: Room, side_ui_container: HTMLElement): HTMLElement {
    const chat = side_ui(side_ui_container, room.chat.element, "Chat")
    const prefs = side_ui(side_ui_container, ui_preferences(), "Settings")
    const local_controls = ediv({ class: "local-controls", aria_label: "local resources" },
        ebutton("Microphone", { onclick: () => room.local_user.await_add_resource(create_mic_res()) }),
        ebutton("Camera", { onclick: () => room.local_user.await_add_resource(create_camera_res()) }),
        ebutton("Screen", { onclick: () => room.local_user.await_add_resource(create_screencast_res()) }),
        ebutton("File", { onclick: () => room.local_user.await_add_resource(create_file_res()) }),
    )
    return enav({ class: "control-bar" }, chat.el, prefs.el, local_controls)
}

export interface SideUI { el: HTMLElement, set_state: (s: boolean) => void }
export function side_ui(container: HTMLElement, content: HTMLElement, label: string): SideUI {
    // TODO: close other side uis
    const checkbox = einput("checkbox", {
        onchange: () => {
            if (checkbox.checked) {
                content.classList.add("animate-in")
                container.appendChild(content)
            } else {
                content.classList.remove("animate-in")
                content.classList.add("animate-out")
                setTimeout(() => { // TODO breaks if ui is being enabled while timeout is active 
                    content.classList.remove("animate-out")
                    container.removeChild(content)
                }, 400)
            }
        }
    })
    return {
        el: elabel(label, { class: "side-ui-control" }, checkbox),
        set_state(s) { checkbox.checked = s }
    }
}