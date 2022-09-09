import { ClientboundPacket, RelayMessage, ServerboundPacket } from "../../../common/packets.d.ts"
import { log } from "../logger.ts"
import { crypto_encrypt, crypto_seeded_key, crypt_decrypt, crypt_hash } from "./crypto.ts"

export class SignalingConnection {
    room!: string
    websocket!: WebSocket
    signaling_id!: string
    key!: CryptoKey

    control_handler: (_packet: ClientboundPacket) => void = () => { }
    relay_handler: (_sender: number, _message: RelayMessage) => void = () => { }

    constructor() { }
    async connect(room: string): Promise<SignalingConnection> {
        this.key = await crypto_seeded_key(room)
        this.signaling_id = await crypt_hash(room)
        log("ws", "connecting…")
        const ws_url = new URL(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/signaling/${encodeURIComponent(this.signaling_id)}`)
        this.websocket = new WebSocket(ws_url)
        this.websocket.onerror = () => this.on_error()
        this.websocket.onmessage = e => {
            if (typeof e.data == "string") this.on_message(e.data)
        }
        await new Promise<void>(r => this.websocket!.onopen = () => {
            this.on_open()
            r()
        })
        log("ws", "connection opened")
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
        log("error", "websocket error occurred!")
    }
    async on_message(data: string) {
        const packet: ClientboundPacket = JSON.parse(data) // TODO dont crash if invalid
        this.control_handler(packet)
        if (packet.message) {
            const inner_json = await crypt_decrypt(this.key, packet.message.message)
            const inner: RelayMessage = JSON.parse(inner_json) // TODO make sure that protocol spec is met
            this.relay_handler(packet.message.sender, inner)
        }
    }

    send_control(data: ServerboundPacket) {
        log("ws", `-> ${data.relay?.recipient ?? "*"}`, data)
        this.websocket.send(JSON.stringify(data))
    }
    async send_relay(data: RelayMessage, recipient?: number | null) {
        recipient ??= undefined // null -> undefined
        const message = await crypto_encrypt(this.key, JSON.stringify(data))
        this.send_control({ relay: { recipient, message } })
    }
}