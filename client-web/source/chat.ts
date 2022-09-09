import { ediv, espan, OverlayUi } from "./helper.ts";
import { Room } from "./room.ts";
import { User } from "./user/mod.ts";

export class Chat extends OverlayUi {
    messages: HTMLElement
    controls: HTMLElement

    constructor(public room: Room) {
        const send = document.createElement("input")
        send.type = "text"
        send.onkeydown = (ev) => {
            if (ev.code == "Enter") {
                room.local_user.chat(send.value)
                this.send_message(room.local_user, send.value)
                send.value = ""
            }
        }
        const messages = ediv({ class: "messages" })
        const controls = ediv({ class: "controls" })
        controls.append(send)
        messages.append(document.createElement("hr"))
        super(ediv({ class: "chat" }, messages, controls))
        this.messages = messages
        this.controls = controls
    }

    send_message(sender: User, message: string) {
        this.messages.append(ediv({ class: "message" },
            espan(sender.display_name, { class: "author" }),
            ": ",
            espan(message, { class: "content" })
        ))
    }
}
