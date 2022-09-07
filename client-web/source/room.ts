/// <reference lib="dom" />

import { log } from "./logger.ts";
import { RemoteUser } from "./remote_user.ts";
import { User } from "./user.ts";
import { LocalUser } from "./local_user.ts";
import { hex_id, parameter_string } from "./helper.ts";
import { ServerboundPacket, ClientboundPacket } from "../../common/packets.d.ts";


export class Room {
    el: HTMLElement
    name: string
    users: Map<number, User> = new Map()
    remote_users: Map<number, RemoteUser> = new Map()
    local_user!: LocalUser
    websocket: WebSocket

    constructor(name: string) {
        this.name = name
        this.el = document.createElement("div")
        this.el.classList.add("room")
        this.websocket = new WebSocket(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/signaling/${encodeURIComponent(name)}`)
        this.websocket.onclose = () => this.websocket_close()
        this.websocket.onopen = () => this.websocket_open()
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
            this.local_user = new LocalUser(this, packet.init.your_id, "...");
        }
        if (packet.client_join) {
            const p = packet.client_join
            log("*", `${this.name} ${p.id} joined`);
            const ru = new RemoteUser(this, p.id, p.name)
            this.local_user.add_initial_to_remote(ru)
            ru.offer()
            this.users.set(p.id, ru)
            this.remote_users.set(p.id, ru)
            return
        } else if (packet.client_leave) {
            const p = packet.client_leave;
            log("*", `${this.name} ${p.id} left`);
            this.remote_users.get(p.id)!.leave()
            this.users.delete(p.id)
            this.remote_users.delete(p.id)
            return
        }
        if (packet.message) {
            const p = packet.message;
            const sender = this.remote_users.get(p.sender)!
            if (p.message.ice_candidate) sender.add_ice_candidate(p.message.ice_candidate)
            if (p.message.offer) sender.on_offer(p.message.offer)
            if (p.message.answer) sender.on_answer(p.message.answer)
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
        this.websocket.send(this.local_user.name)
        setInterval(() => this.websocket_send({}), 30000) // stupid workaround for nginx disconnection inactive connections
    }
}