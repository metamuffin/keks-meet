import { log } from "./logger";
import { CSPacket, SCPacket } from "./types";
import { RemoteUser } from "./remote_user";
import { User } from "./user";
import { LocalUser } from "./local_user";
import { parameters } from ".";
import { hex_id, parameter_string } from "./helper";


export class Room {
    el: HTMLElement
    name: string
    users: Map<string, User> = new Map()
    remote_users: Map<string, RemoteUser> = new Map()
    local_user: LocalUser
    websocket: WebSocket

    constructor(name: string) {
        this.name = name
        this.el = document.createElement("div")
        this.el.classList.add("room")
        this.websocket = new WebSocket(`ws://${window.location.host}/signaling/${encodeURIComponent(name)}`)
        this.websocket.onclose = () => this.websocket_close()
        this.websocket.onopen = () => this.websocket_open()
        this.websocket.onmessage = (ev) => {
            this.websocket_message(JSON.parse(ev.data))
        }
        this.local_user = new LocalUser(this, parameter_string("username", `guest-${hex_id()}`))
    }

    websocket_send(data: CSPacket) {
        log("ws", `-> ${data.receiver ?? "*"}`, data)
        this.websocket.send(JSON.stringify(data))
    }
    websocket_message(packet: SCPacket) {
        if (packet.join) {
            log("*", `${this.name} ${packet.sender} joined`);
            const ru = new RemoteUser(this, packet.sender)
            this.local_user.add_initial_to_remote(ru)
            if (!packet.stable) ru.offer()
            this.users.set(packet.sender, ru)
            this.remote_users.set(packet.sender, ru)
            return
        }
        const sender = this.remote_users.get(packet.sender)
        if (!sender) return console.warn(`unknown sender ${packet.sender}`)
        if (packet.leave) {
            log("*", `${this.name} ${packet.sender} left`);
            sender.leave()
            this.users.delete(packet.sender)
            this.remote_users.delete(packet.sender)
            return
        }
        if (!packet.data) return console.warn("dataless packet")
        log("ws", `<- ${packet.sender}: `, packet.data);
        if (packet.data.ice_candiate) sender.add_ice_candidate(packet.data.ice_candiate)
        if (packet.data.offer) sender.on_offer(packet.data.offer)
        if (packet.data.answer) sender.on_answer(packet.data.answer)
    }
    websocket_close() {
        log("ws", "websocket closed");
    }
    websocket_open() {
        log("ws", "websocket opened");
        this.websocket.send(this.local_user.name)
    }
}