import { ediv, espan } from "./helper.ts";
import { CHAT } from "./index.ts";
import { Room } from "./room.ts";
import { User } from "./user/mod.ts";

export class Chat {
    private _shown = false;

    messages = ediv({ class: "messages" })
    controls = ediv({ class: "controls" })

    get shown() { return this._shown }
    set shown(value: boolean) {
        if (value && !this._shown) document.body.prepend(CHAT)
        if (!value && this._shown) document.body.removeChild(CHAT)
        this._shown = value
    }

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
        this.controls.append(send)
        this.messages.append(document.createElement("hr"))
        CHAT.append(this.messages, this.controls)
    }

    send_message(sender: User, message: string) {
        this.messages.append(ediv({ class: "message" },
            espan(sender.display_name, { class: "author" }),
            ": ",
            espan(message, { class: "content" })
        ))
    }
}
