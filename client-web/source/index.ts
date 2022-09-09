/// <reference lib="dom" />

import { ediv, OVERLAYS } from "./helper.ts";
import { log, LOGGER_CONTAINER } from "./logger.ts"
import { BottomMenu, MenuBr } from "./menu.ts";
import { load_params, PREFS } from "./preferences/mod.ts";
import { SignalingConnection } from "./protocol/mod.ts";
import { Room } from "./room.ts"

export const VERSION = "0.1.8"
export const ROOM_CONTAINER = ediv({ class: "room" })

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
    log("*", "starting up")
    document.body.querySelectorAll("p").forEach(e => e.remove())
    const room_name = load_params().rname

    if (!globalThis.RTCPeerConnection) return log({ scope: "webrtc", error: true }, "WebRTC not supported.")
    if (!globalThis.isSecureContext) log({ scope: "*", warn: true }, "This page is not in a 'Secure Context'")
    if (!globalThis.crypto.subtle) return log({ scope: "crypto", error: true }, "SubtleCrypto not availible")
    if (room_name.length < 8) log({ scope: "crypto", warn: true }, "Room name is very short. e2ee is insecure!")
    if (room_name.length == 0) return window.location.href = "/" // send them back to the start page
    if (PREFS.warn_redirect) log({ scope: "crypto", warn: true }, "You were redirected from the old URL format. The server knows the room name now - e2ee is insecure!")

    const conn = await (new SignalingConnection().connect(room_name))
    const r = new Room(conn)

    r.on_ready = () => {
        new BottomMenu(r).shown = true
        new MenuBr().shown = true
    }
    document.body.append(ROOM_CONTAINER, OVERLAYS, LOGGER_CONTAINER)
}
