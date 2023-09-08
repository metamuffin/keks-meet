/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { init_serviceworker } from "./sw/client.ts";
import { e } from "./helper.ts";
import { setup_keybinds } from "./keybinds.ts";
import { log, LOGGER_CONTAINER } from "./logger.ts"
import { load_params, PREFS } from "./preferences/mod.ts";
import { SignalingConnection } from "./protocol/mod.ts";
import { Room } from "./room.ts"
import { control_bar, info_br } from "./menu.ts";

export const VERSION = "0.2.2"

export interface ClientConfig {
    appearance?: {
        accent: string
        accent_dark: string
        accent_light: string
        background: string
        background_dark: string
    }
    webrtc: {
        stun: string,
        turn?: string,
        turn_user?: string,
        turn_cred?: string
    }
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
window.onbeforeunload = ev => {
    if (r.local_user.resources.size != 0 && PREFS.enable_onbeforeunload) {
        ev.preventDefault()
        return ev.returnValue = "You have local resources shared. Really quit?"
    }
}

let r: Room;
export async function main() {
    document.body.append(LOGGER_CONTAINER)
    log("*", "loading client config")
    const config_res = await fetch("/config.json")
    if (!config_res.ok) return log({ scope: "*", error: true }, "cannot load config")
    const config: ClientConfig = await config_res.json()
    log("*", "config loaded. starting")

    document.body.querySelectorAll(".loading").forEach(e => e.remove())
    const room_secret = load_params().rsecret

    if (!globalThis.isSecureContext) log({ scope: "*", warn: true }, "This page is not in a 'Secure Context'")
    if (!globalThis.RTCPeerConnection) return log({ scope: "webrtc", error: true }, "WebRTC not supported.")
    if (!globalThis.crypto.subtle) return log({ scope: "crypto", error: true }, "SubtleCrypto not availible")
    if (!globalThis.navigator.serviceWorker) log({ scope: "*", warn: true }, "Your browser does not support the Service Worker API, forced automatic updates are unavoidable.")
    if (room_secret.length < 8) log({ scope: "crypto", warn: true }, "Room name is very short. e2ee is insecure!")
    if (room_secret.length == 0) return window.location.href = "/" // send them back to the start page
    if (PREFS.warn_redirect) log({ scope: "crypto", warn: true }, "You were redirected from the old URL format. The server knows the room secret now - e2ee is insecure!")

    if (room_secret.split("#").length > 1) document.title = `${room_secret.split("#")[0]} | keks-meet`

    const conn = await (new SignalingConnection().connect())
    const rtc_config: RTCConfiguration = {
        iceCandidatePoolSize: 10,
        iceServers: [{
            urls: [config.webrtc.stun, ...(config.webrtc.turn ? [config.webrtc.turn] : [])],
            credential: config.webrtc.turn_cred,
            username: config.webrtc.turn_user,
        }]
    }

    r = new Room(conn, rtc_config)

    setup_keybinds(r)
    r.on_ready = () => {
        const sud = e("div", { class: "side-ui" })
        const center = e("div", { class: "main" }, r.element, info_br(), sud)
        document.body.append(center, control_bar(r, sud))
    }

    if (globalThis.navigator.serviceWorker) init_serviceworker()
    await conn.join(room_secret)
}
