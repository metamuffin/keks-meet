/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ebutton, ediv, efooter, enav, ep, OverlayUi } from "./helper.ts"
import { VERSION } from "./index.ts"
import { PrefUi } from "./preferences/ui.ts"
import { create_file_res } from "./resource/file.ts";
import { create_camera_res, create_mic_res, create_screencast_res } from "./resource/track.ts";
import { Room } from "./room.ts"

export class MenuBr extends OverlayUi {
    constructor() {
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

        super(efooter({ class: "menu-br" },
            ep(`keks-meet ${VERSION}`, { class: "version" }),
            item("License", "https://codeberg.org/metamuffin/keks-meet/raw/branch/master/COPYING"),
            item("Source code", "https://codeberg.org/metamuffin/keks-meet"),
            item("Documentation", "https://codeberg.org/metamuffin/keks-meet/src/branch/master/readme.md"),
        ), true)
    }
}

export class BottomMenu extends OverlayUi {
    constructor(room: Room) {
        // TODO this should ideally be a checkbox 
        const chat_toggle = document.createElement("input")
        chat_toggle.type = "button"
        chat_toggle.value = "Chat"
        chat_toggle.ariaHasPopup = "menu"
        chat_toggle.onclick = () => {
            room.chat.shown = !room.chat.shown
            if (room.chat.shown) chat_toggle.classList.add("active")
            else chat_toggle.classList.remove("active")
        }

        const prefs_button = document.createElement("input")
        prefs_button.type = "button"
        prefs_button.value = "Settings"
        prefs_button.ariaHasPopup = "menu"

        const prefs = new PrefUi()
        prefs_button.onclick = () => {
            prefs.shown = !prefs.shown
            if (prefs.shown) prefs_button.classList.add("active")
            else prefs_button.classList.remove("active")
        }

        const local_controls = ediv({ class: "local-controls", aria_label: "local resources" },
            ebutton("Microphone", { onclick: () => room.local_user.await_add_resource(create_mic_res()) }),
            ebutton("Camera", { onclick: () => room.local_user.await_add_resource(create_camera_res()) }),
            ebutton("Screen", { onclick: () => room.local_user.await_add_resource(create_screencast_res()) }),
            ebutton("File", { onclick: () => room.local_user.await_add_resource(create_file_res()) }),
        )

        super(enav({ class: "bottom-menu" }, chat_toggle, prefs_button, local_controls))
    }
}
