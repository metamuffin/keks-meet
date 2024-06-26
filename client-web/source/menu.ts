/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { e, sleep } from "./helper.ts"
import { AppState } from "./index.ts";
import { VERSION } from "./index.ts"
import { PO } from "./locale/mod.ts";
import { ui_preferences } from "./preferences/ui.ts"
import { create_file_res } from "./resource/file.ts";
import { create_camera_res, create_mic_res, create_screencast_res } from "./resource/track.ts";
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
        item(PO.license, "https://codeberg.org/metamuffin/keks-meet/raw/branch/master/COPYING"),
        item(PO.source_code, "https://codeberg.org/metamuffin/keks-meet"),
        item(PO.documentation, "https://codeberg.org/metamuffin/keks-meet/src/branch/master/readme.md"),
    )
}

export let chat_control: (s?: boolean) => void;

export function control_bar(state: AppState, side_ui_container: HTMLElement): HTMLElement {
    const leave = e("button", { icon: "leave", class: "abort", onclick() { window.location.href = "/" } },PO.leave)
    const chat = side_ui(side_ui_container, state.chat.element, "chat", PO.chat, state.chat)
    const prefs = side_ui(side_ui_container, ui_preferences(), "settings", PO.settings)
    const rwatches = side_ui(side_ui_container, ui_room_watches(state.conn), "room", PO.known_rooms)
    const local_controls = [
        e("button", { icon: "microphone", onclick: () => state.room?.local_user.await_add_resource(create_mic_res()) }, PO.microphone),
        e("button", { icon: "camera", onclick: () => state.room?.local_user.await_add_resource(create_camera_res()) }, PO.camera),
        e("button", { icon: "screen", onclick: () => state.room?.local_user.await_add_resource(create_screencast_res()) }, PO.screen),
        e("button", { icon: "file", onclick: () => state.room?.local_user.await_add_resource(create_file_res()) }, PO.file),
    ]
    chat_control = chat.set_state;
    return e("div", {
        class: "control-bar",
        role: "toolbar",
        aria_label: PO.controls,
        onkeydown: (_el, ev) => {
            if (ev.code == "ArrowLeft") {
                let n = document.activeElement?.previousElementSibling
                if (n instanceof HTMLElement && n.role == "separator") n = n.previousElementSibling
                if (n instanceof HTMLElement) n.focus()
            } else if (ev.code == "ArrowRight") {
                let n = document.activeElement?.nextElementSibling
                if (n instanceof HTMLElement && n.role == "separator") n = n.nextElementSibling
                if (n instanceof HTMLElement) n.focus()
            }
        }
    },
        leave,
        e("span", { role: "separator" }, "|"),
        chat.el,
        prefs.el,
        rwatches.el,
        e("span", { role: "separator" }, "|"),
        ...local_controls)
}

export interface SideUI { el: HTMLElement, set_state: (s?: boolean) => void }
let close_active: (() => void) | undefined;
let cancel_slide: number | undefined
export function side_ui(container: HTMLElement, content: HTMLElement, icon: string, label: string, handlers = { focus() { } }): SideUI {
    const tray = e("div", { class: "side-tray" }, content)
    let checked = false;
    const el = e("button", {
        class: "side-ui-control",
        icon,
        onclick: () => set_state()
    }, label)
    const set_state = async (s?: boolean) => {
        if (s == checked) return
        checked = s ?? !checked
        if (checked) {
            el.classList.add("checked")
            el.ariaPressed = "false";
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
            el.ariaPressed = "true";
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
    }
    el.ariaPressed = "false"
    return { el, set_state }
}
