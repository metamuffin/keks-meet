import { Router } from "https://deno.land/x/oak@v10.1.0/router.ts";
import { CSPacket, SCPacket } from "../packets.ts";

export const api = new Router()

type Room = Map<string, WebSocket>
const rooms: Map<string, Room> = new Map()

function send_packet(ws: WebSocket, packet: SCPacket) {
    ws.send(JSON.stringify(packet))
}

api.get("/signaling/:id", c => {
    const ws = c.upgrade()

    const room_name = c.params.id
    const room: Room = rooms.get(c.params.id) ?? new Map()
    let initialized = false
    let user_name = ""

    const init = (n: string) => {
        if (room.get(n)) return ws.close()
        initialized = true
        user_name = n
        rooms.set(c.params.id, room)
        room.forEach(uws => send_packet(uws, { sender: user_name, join: true }))
        room.forEach((_, uname) => send_packet(ws, { sender: uname, join: true, stable: true }))
        room.set(user_name, ws)
        console.log(`[${room_name}] ${user_name} joined`)
    }
    ws.onclose = () => {
        room.delete(user_name)
        room.forEach(uws => send_packet(uws, { sender: user_name, leave: true }))
        if (room.size == 0) rooms.delete(room_name)
        console.log(`[${room_name}] ${user_name} left`)
    }
    ws.onmessage = ev => {
        const message = ev.data.toString()
        if (!initialized) return init(message)
        let in_packet: CSPacket;
        try { in_packet = JSON.parse(message) }
        catch (_e) { return }

        if (JSON.stringify(in_packet) == "{}") return // drop ping

        console.log(`[${room_name}] ${user_name} -> ${in_packet.receiver ?? "*"}: ${message.substr(0, 100)}`)
        const out_packet: SCPacket = { sender: user_name, data: in_packet }

        if (in_packet.receiver) {
            const rws = room.get(in_packet.receiver)
            if (rws) send_packet(rws, out_packet)
        } else {
            room.forEach((uws, uname) => {
                if (uname != user_name) send_packet(uws, out_packet)
            })
        }
    }
})
