import { log } from "./logger";
import { CSPacket, SCPacket } from "./types";
import { User } from "./user";


export class Room {
    el: HTMLElement
    name: string
    users: Map<string, User> = new Map()
    websocket: WebSocket

    constructor(name: string) {
        this.name = name
        this.el = document.createElement("div")

        this.websocket = new WebSocket(`ws://${window.location.host}/room/${encodeURIComponent(name)}`)
        this.websocket.onclose = () => this.websocket_close()
        this.websocket.onopen = () => this.websocket_open()
        this.websocket.onmessage = (ev) => {
            this.websocket_message(JSON.parse(ev.data))
        }
    }

    websocket_send(data: CSPacket) {
        log("ws", `-> ${data.receiver ?? "*"}`, data)
        this.websocket.send(JSON.stringify(data))
    }
    websocket_message(packet: SCPacket) {
        if (packet.join) {
            log("*", `${this.name} ${packet.sender} joined`);
            this.users.set(packet.sender, new User(this, packet.sender, !packet.stable))
            return
        }
        const sender = this.users.get(packet.sender)
        if (!sender) return console.warn(`unknown sender ${packet.sender}`)
        if (packet.leave) {
            log("*", `${this.name} ${packet.sender} left`);
            sender.leave()
            this.users.delete(packet.sender)
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
        this.websocket.send(Math.random().toString())
    }
}