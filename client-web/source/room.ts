/// <reference lib="dom" />

import { log } from "./logger.ts";
import { RemoteUser } from "./remote_user.ts";
import { User } from "./user.ts";
import { LocalUser } from "./local_user.ts";
import { ServerboundPacket, ClientboundPacket } from "../../common/packets.d.ts";
import { PREFS } from "./preferences.ts";
import { ep } from "./helper.ts";

export class Room {
    el: HTMLElement
    name: string
    users: Map<number, User> = new Map()
    remote_users: Map<number, RemoteUser> = new Map()
    local_user!: LocalUser
    my_id!: number
    websocket: WebSocket

    constructor(name: string) {
        this.name = name
        this.el = document.createElement("div")
        this.el.classList.add("room")

        const ws_url = new URL(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/${encodeURIComponent(name)}/signaling`)
        ws_url.searchParams.set("username", PREFS.username)
        this.websocket = new WebSocket(ws_url)
        this.websocket.onclose = () => this.websocket_close()

        // const connecting_text = ep("Upgrading to a websocket connection…")
        // this.el.append(connecting_text)

        this.websocket.onopen = () => {
            // connecting_text.remove()
            this.websocket_open()
        }
        this.websocket.onmessage = (ev) => {
            this.websocket_message(JSON.parse(ev.data))
        }
    }

    websocket_send(data: ServerboundPacket) {
        log("ws", `-> ${data.relay?.recipient ?? "*"}`, data)
        this.websocket.send(JSON.stringify(data))
    }
    websocket_message(packet: ClientboundPacket) {
        log("ws", `<- ${packet.message?.sender ?? "control packet"}: `, packet);
        if (packet.init) {
            this.my_id = packet.init.your_id
            // no need to check compat for now because this is hosted in the same place
            log("*", `server: ${packet.init.version}`)
        } else if (packet.client_join) {
            const p = packet.client_join
            log("*", `${this.name} ${p.id} joined`);
            if (p.id == this.my_id) {
                this.local_user = new LocalUser(this, p.id, p.name);
            } else {
                const ru = new RemoteUser(this, p.id, p.name)
                this.local_user.add_initial_to_remote(ru)
                ru.offer()
                this.users.set(p.id, ru)
                this.remote_users.set(p.id, ru)
            }
        } else if (packet.client_leave) {
            const p = packet.client_leave;
            log("*", `${this.name} ${p.id} left`);
            this.remote_users.get(p.id)!.leave()
            this.users.delete(p.id)
            this.remote_users.delete(p.id)
            return
        } else if (packet.message) {
            const p = packet.message;
            const sender = this.users.get(p.sender)
            if (sender instanceof RemoteUser) {
                if (p.message.ice_candidate) sender.add_ice_candidate(p.message.ice_candidate)
                if (p.message.offer) sender.on_offer(p.message.offer)
                if (p.message.answer) sender.on_answer(p.message.answer)
            } else {
                console.log("!", p, sender);
            }
        }
    }
    websocket_close() {
        log("ws", "websocket closed");
        setTimeout(() => {
            window.location.reload()
        }, 1000)
    }
    websocket_open() {
        log("ws", "websocket opened");
        setInterval(() => this.websocket_send({ ping: null }), 30000) // stupid workaround for nginx disconnecting inactive connections
    }
}