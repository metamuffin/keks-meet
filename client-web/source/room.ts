/// <reference lib="dom" />

import { log } from "./logger.ts";
import { RemoteUser } from "./user/remote.ts";
import { User } from "./user/mod.ts";
import { LocalUser } from "./user/local.ts";
import { ClientboundPacket, RelayMessage } from "../../common/packets.d.ts";
import { SignalingConnection } from "./protocol/mod.ts";

export class Room {
    public users: Map<number, User> = new Map()
    public remote_users: Map<number, RemoteUser> = new Map()
    public local_user!: LocalUser
    public my_id!: number

    constructor(public signaling: SignalingConnection) {
        this.signaling.control_handler = (a) => this.control_handler(a)
        this.signaling.relay_handler = (a, b) => this.relay_handler(a, b)
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