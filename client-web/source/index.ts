/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ediv, OVERLAYS } from "./helper.ts";
import { setup_keybinds } from "./keybinds.ts";
import { log, LOGGER_CONTAINER } from "./logger.ts"
import { BottomMenu, MenuBr } from "./menu.ts";
import { load_params, PREFS } from "./preferences/mod.ts";
import { SignalingConnection } from "./protocol/mod.ts";
import { Room } from "./room.ts"

export const VERSION = "0.1.9"
export const ROOM_CONTAINER = ediv({ class: "room" })

export const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                "turn:meet.metamuffin.org:16900",
                "stun:meet.metamuffin.org:16900"
            ],
            username: "keksmeet",
            credential: "ujCmetg6bm0"
        },
    ],
    iceCandidatePoolSize: 10,
}

export interface User {
    peer: RTCPeerConnection
    stream: MediaStream,
}

window.onload = () => main()
window.onhashchange = () => {
    // TODO might just destroy room object and create a new one, but cleanup probably wont work. lets reload instead
    window.location.reload()
}

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

    setup_keybinds(r)
    r.on_ready = () => {
        new BottomMenu(r).shown = true
        new MenuBr().shown = true
    }
    document.body.append(ROOM_CONTAINER, OVERLAYS, LOGGER_CONTAINER)
}
