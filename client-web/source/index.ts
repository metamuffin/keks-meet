/// <reference lib="dom" />

import { ediv } from "./helper.ts";
import { log } from "./logger.ts"
import { create_menu } from "./menu.ts";
import { SignalingConnection } from "./protocol/mod.ts";
import { Room } from "./room.ts"


export const BOTTOM_CONTAINER = ediv({ class: ["bottom-container"] })
export const ROOM_CONTAINER = ediv({ class: ["room"] })

export const RTC_CONFIG: RTCConfiguration = {
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
    const room_name = window.location.hash.substring(1)
    if (room_name.length == 0) window.location.href = "/" // send them back to the start page
    const conn = await (new SignalingConnection().connect(room_name))
    new Room(conn)
    create_menu()
    document.body.append(ROOM_CONTAINER, BOTTOM_CONTAINER)
}
