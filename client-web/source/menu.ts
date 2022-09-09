/// <reference lib="dom" />

import { ediv, ep, OverlayUi } from "./helper.ts"
import { VERSION } from "./index.ts"
import { PrefUi } from "./preferences/ui.ts"
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

        super(ediv({ class: "menu-br" },
            ep(`keks-meet ${VERSION}`, { class: "version" }),
            item("Licence", "/licence"),
            item("Sources / Documentation", "https://codeberg.org/metamuffin/keks-meet"),
        ), true)
    }
}

export class BottomMenu extends OverlayUi {
    constructor(room: Room) {
        // TODO this should ideally be a checkbox 
        const chat_toggle = document.createElement("input")
        chat_toggle.type = "button"
        chat_toggle.value = "Toggle chat"
        chat_toggle.onclick = () => {
            room.chat.shown = !room.chat.shown
            if (room.chat.shown) chat_toggle.classList.add("active")
            else chat_toggle.classList.remove("active")
        }

        const prefs_button = document.createElement("input")
        prefs_button.type = "button"
        prefs_button.value = "Settings"

        const prefs = new PrefUi()
        prefs_button.onclick = () => {
            prefs.shown = !prefs.shown
            if (prefs.shown) prefs_button.classList.add("active")
            else prefs_button.classList.remove("active")
        }

        super(ediv({ class: "bottom-menu" }, chat_toggle, prefs_button, room.local_user.create_controls()))
    }
}
