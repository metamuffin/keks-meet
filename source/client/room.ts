import { CSPacket, SCPacket} from "./types";
import { User } from "./user";


export class Room {
    el: HTMLElement
    name: string
    users: Map<string, User> = new Map()
    websocket: WebSocket
    local_user: User

    constructor(name: string) {
        this.name = name
        this.el = document.createElement("div")

        this.websocket = new WebSocket(`ws://${window.location.host}/room/${encodeURIComponent(name)}`)
        this.websocket.onclose = () => this.websocket_close()
        this.websocket.onopen = () => this.websocket_open()
        this.websocket.onmessage = (ev) => {
            this.websocket_message(JSON.parse(ev.data))
        }
        // const name =  prompt() ?? "nameless user"
        const uname = Math.random().toString()
        this.local_user = new User(this, uname, true)
    }

    websocket_send(data: CSPacket) {
        this.websocket.send(JSON.stringify(data))
    }
    websocket_message(packet: SCPacket) {
        console.log("websocket message", packet);
        if (packet.join) {
            this.users.set(packet.sender, new User(this, packet.sender))
            return
        }
        const sender = this.users.get(packet.sender)
        if (!sender) return console.warn(`unknown sender ${packet.sender}`)
        if (packet.leave) {
            sender.leave()
            this.users.delete(packet.sender)
            return
        }

        if (packet.data.ice_candiate) sender.add_ice_candidate(packet.data.ice_candiate)
    }
    websocket_close() {
        console.log("websocket closed");
    }
    websocket_open() {
        console.log("websocket opened");
        this.websocket.send(this.local_user.name)
    }
}