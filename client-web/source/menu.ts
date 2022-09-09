/// <reference lib="dom" />

import { ep } from "./helper.ts"
import { BOTTOM_CONTAINER, MENU_BR, VERSION } from "./index.ts"
import { Room } from "./room.ts"

export function setup_menus(room: Room) {
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

    MENU_BR.append(
        ep(`keks-meet ${VERSION}`, { class: "version" }),
        item("Settings", () => alert("todo, refer to the url parameters in the docs for now")),
        item("Licence", "/licence"),
        item("Sources / Documentation", "https://codeberg.org/metamuffin/keks-meet"),
    )


    // TODO this should ideally be a checkbox 
    const chat_toggle = document.createElement("input")
    chat_toggle.type = "button"
    chat_toggle.id = "chat_toggle"
    chat_toggle.value = "Toggle chat"
    chat_toggle.onclick = () => {
        room.chat.shown = !room.chat.shown
        if (room.chat.shown) chat_toggle.classList.add("active")
        else chat_toggle.classList.remove("active")
    }
    BOTTOM_CONTAINER.append(chat_toggle)
}
