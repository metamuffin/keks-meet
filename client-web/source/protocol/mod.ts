import { crypto_seeded_key } from "./crypto.ts"

export class SignalingConnection {
    room!: string
    websocket!: WebSocket
    signaling_id!: string
    key!: CryptoKey

    constructor() { }
    async connect(room: string): Promise<SignalingConnection> {
        this.key = await crypto_seeded_key(room)
        const ws_url = new URL(`${window.location.protocol.endsWith("s:") ? "wss" : "ws"}://${window.location.host}/signaling/${encodeURIComponent(this.signaling_id)}`)
        this.websocket = new WebSocket(ws_url)
        await new Promise(r => this.websocket!.onopen = r)
        return this
    }
}
