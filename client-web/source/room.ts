/// <reference lib="dom" />

import { log } from "./logger.ts";
import { RemoteUser } from "./remote_user.ts";
import { User } from "./user.ts";
import { LocalUser } from "./local_user.ts";
import { ClientboundPacket, RelayMessage } from "../../common/packets.d.ts";
import { SignalingConnection } from "./protocol/mod.ts";

export class Room {
    el: HTMLElement
    users: Map<number, User> = new Map()
    remote_users: Map<number, RemoteUser> = new Map()
    local_user!: LocalUser
    my_id!: number

    constructor(public signaling: SignalingConnection) {
        this.el = document.createElement("div")
        this.el.classList.add("room")
        this.signaling.control_handler = this.control_handler
        this.signaling.relay_handler = this.relay_handler
    }

    control_handler(packet: ClientboundPacket) {
        if (packet.message) return // let the relay handler do that
        log("ws", `<- [control packet]: `, packet);
        if (packet.init) {
            this.my_id = packet.init.your_id
            // no need to check compat for now because this is hosted in the same place
            log("*", `server: ${packet.init.version}`)
        } else if (packet.client_join) {
            const p = packet.client_join
            log("*", `${p.id} joined`);
            if (p.id == this.my_id) {
                this.local_user = new LocalUser(this, p.id);
            } else {
                const ru = new RemoteUser(this, p.id)
                this.local_user.add_initial_to_remote(ru)
                ru.offer()
                this.users.set(p.id, ru)
                this.remote_users.set(p.id, ru)
            }
        } else if (packet.client_leave) {
            const p = packet.client_leave;
            log("*", `${p.id} left`);
            this.remote_users.get(p.id)!.leave()
            this.users.delete(p.id)
            this.remote_users.delete(p.id)
            return
        }

    }
    relay_handler(sender_id: number, message: RelayMessage) {
        const sender = this.users.get(sender_id)
        if (sender instanceof RemoteUser) {
            if (message.ice_candidate) sender.add_ice_candidate(message.ice_candidate)
            if (message.offer) sender.on_offer(message.offer)
            if (message.answer) sender.on_answer(message.answer)
        } else {
            console.log("!", message, sender);
        }
    }
}