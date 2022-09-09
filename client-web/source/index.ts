/// <reference lib="dom" />

import { log } from "./logger.ts"
import { create_menu } from "./menu.ts";
import { SignalingConnection } from "./protocol/mod.ts";
import { Room } from "./room.ts"

export const servers: RTCConfiguration = {
    // google stun!?
    iceServers: [{ urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }],
    iceCandidatePoolSize: 10,
}

export interface User {
    peer: RTCPeerConnection
    stream: MediaStream,
}

window.onload = () => main()

export async function main() {
    document.body.querySelectorAll("p").forEach(e => e.remove())
    log("*", "starting up")
    const room_name = window.location.pathname.substring("/".length)
    const conn = await (new SignalingConnection().connect(room_name))
    const room = new Room(conn)
    create_menu()
    document.body.append(room.el)
}
