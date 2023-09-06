/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin@disroot.org>
*/
import { ClientboundPacket, RelayMessage, RelayMessageWrapper, ServerboundPacket } from "../../../common/packets.d.ts"
import { log } from "../logger.ts"
import { crypto_encrypt, crypto_seeded_key, crypt_decrypt, crypto_hash } from "./crypto.ts"

export class SignalingConnection {
    room!: string
    websocket!: WebSocket
    signaling_id!: string
    key!: CryptoKey
    my_id?: number // needed for outgoing relay messages

    control_handler: (_packet: ClientboundPacket) => void = () => { }
    relay_handler: (_sender: number, _message: RelayMessage) => void = () => { }

    constructor() { }
    async connect(room: string): Promise<SignalingConnection> {
        this.key = await crypto_seeded_key(room)
        this.signaling_id = await crypto_hash(room)
        log("ws", "connecting…")
        const ws_url = new URL(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/signaling/${encodeURIComponent(this.signaling_id)}`)
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
        setInterval(() => this.send_control({ ping: null }), 30000) // stupid workaround for nginx disconnecting inactive connections
    }
    on_error() {
        log({ scope: "ws", error: true }, "websocket error occurred!")
    }
    async on_message(data: string) {
        const packet: ClientboundPacket = JSON.parse(data) // TODO dont crash if invalid
        this.control_handler(packet)
        if (packet.init) this.my_id = packet.init.your_id;
        if (packet.message) {
            const plain_json = await crypt_decrypt(this.key, packet.message.message)
            const plain: RelayMessageWrapper = JSON.parse(plain_json) // TODO make sure that protocol spec is met
            if (plain.sender == packet.message.sender)
                this.relay_handler(packet.message.sender, plain.inner)
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
        const message = await crypto_encrypt(this.key, JSON.stringify(packet))
        this.send_control({ relay: { recipient, message } })
    }
}
