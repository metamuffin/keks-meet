/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { log } from "./logger.ts";
import { RemoteUser } from "./user/remote.ts";
import { LocalUser } from "./user/local.ts";
import { ClientboundPacket, RelayMessage } from "../../common/packets.d.ts";
import { SignalingConnection } from "./protocol/mod.ts";
import { e } from "./helper.ts";
import { Chat } from "./chat.ts";

export class Room {
    public remote_users: Map<number, RemoteUser> = new Map()
    public local_user!: LocalUser
    public element: HTMLElement

    public on_ready = () => { };
    public destroy: () => void

    constructor(public signaling: SignalingConnection, public chat: Chat, public rtc_config: RTCConfiguration) {
        this.element = e("div", { class: "room", aria_label: "user list" })
        const h1 = ([a, b]: [number, RelayMessage]) => this.relay_handler(a, b);
        const h2 = (p: ClientboundPacket) => this.control_handler(p)
        signaling.relay_handler.add_listener(h1)
        signaling.control_handler.add_listener(h2)
        this.destroy = () => {
            signaling.relay_handler.remove_listener(h1)
            signaling.control_handler.remove_listener(h2)
            this.remote_users.forEach(v => v.leave())
            this.local_user.resources.forEach(r => r.destroy())
            this.remote_users = new Map()
        }
    }

    control_handler(packet: ClientboundPacket) {
        if (packet.message) return // let the relay handler do that
        if (packet.init) {
            log("ws", `<- [init packet]: `, packet);
            // no need to check compat for now because this is hosted in the same place
            log("*", `server: ${packet.init.version}`)
        } else if (packet.client_join) {
            log("ws", `<- [client join]: `, packet);
            const p = packet.client_join
            log("*", `${p.id} joined`);
            if (p.id == this.signaling.my_id) {
                this.local_user = new LocalUser(this, p.id);
                this.on_ready()
            } else {
                const ru = new RemoteUser(this, p.id)
                this.local_user.provide_initial_to_remote(ru)
                this.local_user.identify(ru.id)
            }
        } else if (packet.client_leave) {
            log("ws", `<- [client leave]: `, packet);
            const p = packet.client_leave;
            log("*", `${p.id} left`);
            this.remote_users.get(p.id)?.leave()
        }
    }
    relay_handler(sender_id: number, message: RelayMessage) {
        const sender = this.remote_users.get(sender_id)
        if (!sender) return console.warn("sender invalid, somebody is not in sync");
        log("ws", `<- [relay from ${sender.display_name}]: `, message);
        sender.on_relay(message)
    }
}
