import { log } from "../logger.ts"
import { crypto_seeded_key, crypt_hash } from "./crypto.ts"

export class SignalingConnection {
    room!: string
    websocket!: WebSocket
    signaling_id!: string
    key!: CryptoKey

    constructor() { }
    async connect(room: string): Promise<SignalingConnection> {
        this.key = await crypto_seeded_key(room)
        this.signaling_id = await crypt_hash(room)
        log("ws", "connecting…")
        const ws_url = new URL(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/signaling/${encodeURIComponent(this.signaling_id)}`)
        this.websocket = new WebSocket(ws_url)
        await new Promise(r => this.websocket!.onopen = r)
        log("ws", "connection opened")
        return this
    }


}
