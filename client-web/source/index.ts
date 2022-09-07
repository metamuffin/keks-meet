/// <reference lib="dom" />

import { get_query_params } from "./helper.ts"
import { log } from "./logger.ts"
import { create_menu } from "./menu.ts";
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

export const parameters = get_query_params()

window.onload = () => main()

export function main() {
    document.body.querySelector("p")?.remove()
    log("*", "starting up")
    const room_name = window.location.pathname.substring("/".length)
    const room = new Room(room_name)
    create_menu(room)
    document.body.append(room.el)
}
