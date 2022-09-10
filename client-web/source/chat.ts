import { ChatMessage } from "../../common/packets.d.ts";
import { ediv, espan, image_view, OverlayUi } from "./helper.ts";
import { log } from "./logger.ts";
import { Room } from "./room.ts";
import { User } from "./user/mod.ts";

export class Chat extends OverlayUi {
    messages: HTMLElement
    controls: HTMLElement

    constructor(public room: Room) {
        const send = document.createElement("input")
        send.type = "text"

        const messages = ediv({ class: "messages" })
        const controls = ediv({ class: "controls" })
        controls.append(send)
        messages.append(document.createElement("hr"))
        super(ediv({ class: "chat" }, messages, controls))
        this.messages = messages
        this.controls = controls

        send.onkeydown = (ev) => {
            if (ev.code == "Enter") {
                if (send.value.trim().length == 0) return // no!
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

    send(msg: ChatMessage) {
        this.room.local_user.chat(msg)
        this.add_message(this.room.local_user, msg)
    }

    add_message(sender: User, message: ChatMessage) {
        const els = []
        if (message.text) els.push(espan(message.text, { class: "text" }))
        if (message.image) els.push(image_view(message.image, { class: "image" }))

        this.messages.append(ediv({ class: "message" },
            espan(sender.display_name, { class: "author" }), ": ", ...els
        ))
        this.shown = true
        this.notify(sender, message)
    }
    notify(sender: User, message: ChatMessage) {
        if (sender.local || document.hasFocus()) return
        if (Notification.permission != "granted") return
        let body = "(empty message)"
        if (message.text) body = message.text
        if (message.image) body = "(image)"
        new Notification(`keks-meet: ${sender.display_name}`, { body })
    }
}
