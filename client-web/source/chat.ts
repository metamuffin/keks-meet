/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { ChatMessage } from "../../common/packets.d.ts";
import { e, image_view, notify } from "./helper.ts";
import { log } from "./logger.ts";
import { chat_control } from "./menu.ts";
import { PREFS } from "./preferences/mod.ts";
import { Room } from "./room.ts";
import { LocalUser } from "./user/local.ts";
import { User } from "./user/mod.ts";

interface ControlMessage {
    join?: User,
    leave?: User,
    change_room?: string,
}

export class Chat {
    messages: HTMLElement
    controls: HTMLElement
    send_el: HTMLInputElement
    element: HTMLElement

    public room?: Room

    constructor() {
        const send = document.createElement("input")
        send.ariaLabel = "send message"
        send.type = "text"
        send.placeholder = "Type a message"

        const messages = e("div", { class: "messages", aria_live: "polite" })
        const controls = e("div", { class: "controls" })
        controls.append(send)

        this.element = e("section", { class: "chat", aria_label: "chat", role: "dialog" }, messages, controls)
        this.messages = messages
        this.controls = controls
        this.send_el = send

        send.onkeydown = (ev) => {
            if (ev.key == "Enter") {
                if (send.value.trim().length == 0) {
                    // keybind for toggle chat is Enter, so lets close here
                    return chat_control(false)
                }
                this.send({ text: send.value })
                send.value = ""
            }
        }
        document.onpaste = (pasteEvent) => {
            // TODO will only work when pasting a single image
            const item = pasteEvent.clipboardData?.items[0];
            if (!item) return
            if (item.type.indexOf("image") === 0) {
                log("*", "image pasted")
                const blob = item.getAsFile()
                if (!blob) return
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (!event.target) return
                    if (typeof event.target.result != "string") return
                    this.send({ image: event.target.result })
                };
                reader.readAsDataURL(blob);
            }
        }
    }

    focus() { this.send_el.focus() }
    send(msg: ChatMessage) {
        if (this.room) {
            this.room.local_user.chat(msg)
            this.add_message(this.room.local_user, msg)
        }
    }

    remove_oldest_message() {
        this.messages.firstChild?.remove()
    }

    add_control_message(m: ControlMessage) {
        const el = e("div", { class: ["message", "control-message"] }, e("span", { class: "author" }, m.join?.display_name ?? m.leave?.display_name ?? ""), ` ${m.join ? "joined" : "left"} the room.`)
        this.messages.append(el)
        el.scrollIntoView({ block: "end", behavior: "smooth", inline: "end" })
    }

    add_message(sender: User, message: ChatMessage) {
        const els = []
        if (message.text) els.push(e("span", { class: "text" }, message.text))
        if (message.image) els.push(image_view(message.image, { class: "image" }))

        chat_control(true)
        const el = e("div", { class: "message" }, e("span", { class: "author" }, sender.display_name), ": ", ...els)
        this.messages.append(el)
        el.scrollIntoView({ block: "end", behavior: "smooth", inline: "end" })

        let body_str = "(empty message)"
        if (message.text) body_str = message.text
        if (message.image) body_str = "(image)"
        if (!(sender instanceof LocalUser) && PREFS.notify_chat) notify(body_str, sender.display_name)
    }
}
