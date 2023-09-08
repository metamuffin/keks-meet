/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { e, sleep } from "./helper.ts"
import { VERSION } from "./index.ts"
import { ui_preferences } from "./preferences/ui.ts"
import { create_file_res } from "./resource/file.ts";
import { create_camera_res, create_mic_res, create_screencast_res } from "./resource/track.ts";
import { Room } from "./room.ts"
import { ui_room_watches } from "./room_watches.ts";

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

    return e("footer", { class: "info-br" },
        e("p", { class: "version" }, `keks-meet ${VERSION}`),
        item("License", "https://codeberg.org/metamuffin/keks-meet/raw/branch/master/COPYING"),
        item("Source code", "https://codeberg.org/metamuffin/keks-meet"),
        item("Documentation", "https://codeberg.org/metamuffin/keks-meet/src/branch/master/readme.md"),
    )
}

export let chat_control: (s?: boolean) => void;

export function control_bar(room: Room, side_ui_container: HTMLElement): HTMLElement {
    const leave = e("button", { class: "abort", onclick() { window.location.href = "/" } }, "Leave")
    const chat = side_ui(side_ui_container, room.chat.element, "Chat", room.chat)
    const prefs = side_ui(side_ui_container, ui_preferences(), "Settings")
    const rwatches = side_ui(side_ui_container, ui_room_watches(room.signaling), "Known Rooms")
    const local_controls = [ //ediv({ class: "local-controls", aria_label: "local resources" },
        e("button", { onclick: () => room.local_user.await_add_resource(create_mic_res()) }, "Microphone"),
        e("button", { onclick: () => room.local_user.await_add_resource(create_camera_res()) }, "Camera"),
        e("button", { onclick: () => room.local_user.await_add_resource(create_screencast_res()) }, "Screen"),
        e("button", { onclick: () => room.local_user.await_add_resource(create_file_res()) }, "File"),
    ]
    chat_control = chat.set_state;
    return e("nav", { class: "control-bar" }, leave, "|", chat.el, prefs.el, rwatches.el, "|", ...local_controls)
}

export interface SideUI { el: HTMLElement, set_state: (s?: boolean) => void }
let close_active: (() => void) | undefined;
let cancel_slide: number | undefined
export function side_ui(container: HTMLElement, content: HTMLElement, label: string, handlers = { focus() { } }): SideUI {
    const tray = e("div", { class: "side-tray" }, content)
    let last_state = false;
    const checkbox = e("input", {
        type: "checkbox",
        onchange: async () => {
            if (last_state == checkbox.checked) return
            if (checkbox.checked) {
                el.classList.add("checked")
                if (close_active) {
                    close_active()
                    await sleep(200)
                }
                close_active = () => set_state(false)
                if (cancel_slide) {
                    clearTimeout(cancel_slide)
                    cancel_slide = undefined
                    tray.classList.remove("animate-out")
                }
                tray.classList.add("animate-in")
                container.appendChild(tray)
                cancel_slide = setTimeout(() => {
                    handlers.focus()
                }, 200)
            } else {
                el.classList.remove("checked")
                close_active = undefined
                if (cancel_slide) {
                    clearTimeout(cancel_slide)
                    cancel_slide = undefined
                }
                tray.classList.remove("animate-in")
                tray.classList.add("animate-out")
                cancel_slide = setTimeout(() => {
                    tray.classList.remove("animate-out")
                    container.removeChild(tray)
                }, 200)
            }
            last_state = checkbox.checked;
        }
    })
    const set_state = (s: boolean | undefined) => {
        checkbox.checked = s ?? !checkbox.checked;
        if (checkbox.onchange) checkbox.onchange(undefined as unknown as Event)
    }
    const el = e("label", { class: "side-ui-control" }, label, checkbox)
    return { el, set_state }
}
