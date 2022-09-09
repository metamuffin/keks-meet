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
                this.local_user.identify(ru.id)
                ru.offer()
            }
        } else if (packet.client_leave) {
            const p = packet.client_leave;
            log("*", `${p.id} left`);
            this.users.get(p.id)!.leave()
        }
    }
    relay_handler(sender_id: number, message: RelayMessage) {
        const sender = this.users.get(sender_id)
        if (sender instanceof RemoteUser) {
            sender.on_relay(message)
        } else {
            console.warn("we received a message for ourselves, the server might be broken");
        }
    }
}