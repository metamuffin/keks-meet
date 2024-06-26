/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
import { ClientboundPacket, RelayMessage, RelayMessageWrapper, ServerboundPacket } from "../../../common/packets.d.ts"
import { EventEmitter } from "../helper.ts";
import { log } from "../logger.ts"
import { encrypt, derive_seeded_key, decrypt, room_hash } from "./crypto.ts"

export class SignalingConnection {
    websocket!: WebSocket
    room?: string
    room_hash?: string
    key?: CryptoKey
    my_id?: number // needed for outgoing relay messages

    control_handler = new EventEmitter<ClientboundPacket>()
    relay_handler = new EventEmitter<[number, RelayMessage]>()

    constructor() { }
    async connect(): Promise<SignalingConnection> {
        log("ws", "connecting…")
        const ws_url = new URL(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/signaling`)
        this.websocket = new WebSocket(ws_url)
        this.websocket.onerror = () => this.on_error()
        this.websocket.onclose = () => this.on_close()
        this.websocket.onmessage = e => {
            if (typeof e.data == "string") this.on_message(e.data)
        }
        await new Promise<void>(r => this.websocket!.onopen = () => {
            this.on_open()
            r()
        })
        return this
    }

    on_close() {
        log("ws", "websocket closed");
        setTimeout(() => {
            window.location.reload()
        }, 1000)
    }
    on_open() {
        log("ws", "websocket opened");
        setInterval(() => this.send_control({ ping: null }), 30000) // stupid workaround for reverse proxies disconnecting inactive connections
    }

    async join(room: string) {
        this.room = room;
        this.key = await derive_seeded_key(room)
        this.room_hash = await room_hash(room)
        this.send_control({ join: { hash: this.room_hash } })
    }

    on_error() {
        log({ scope: "ws", error: true }, "websocket error occurred!")
    }
    async on_message(data: string) {
        let packet: ClientboundPacket
        try {
            packet = JSON.parse(data)
        } catch (_e) {
            log({ scope: "ws", warn: true }, "server sent invalid json")
            return
        }
        this.control_handler.dispatch(packet)
        if (packet.init) this.my_id = packet.init.your_id;
        if (packet.message) {
            const plain_json = await decrypt(this.key!, packet.message.message)

            let plain: RelayMessageWrapper
            try {
                plain = JSON.parse(plain_json) // TODO make sure that protocol spec is met
            } catch (_e) {
                return log({ scope: "ws", warn: true }, "somebody sent invalid json");
            }
            if (plain.sender == packet.message.sender)
                this.relay_handler.dispatch([packet.message.sender, plain.inner])
            else {
                log({ scope: "crypto", warn: true }, `message dropped: sender inconsistent (${plain.sender} != ${packet.message.sender})`)
            }
        }
    }

    send_control(data: ServerboundPacket) {
        this.websocket.send(JSON.stringify(data))
    }
    async send_relay(data: RelayMessage, recipient?: number | null) {
        recipient ??= undefined // null -> undefined
        const packet: RelayMessageWrapper = { inner: data, sender: this.my_id! }
        const message = await encrypt(this.key!, JSON.stringify(packet))
        this.send_control({ relay: { recipient, message } })
    }
}
