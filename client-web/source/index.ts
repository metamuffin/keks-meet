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
import { Chat } from "./chat.ts"
import { init_locale } from "./locale/mod.ts";
import { PO } from "./locale/mod.ts";

export const VERSION = "1.0.4"
globalThis.addEventListener("DOMContentLoaded", () => main())

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


export interface AppState {
    conn: SignalingConnection,
    room?: Room
    chat: Chat,
    center: HTMLElement
}

function set_room(state: AppState, secret: string, rtc_config: RTCConfiguration) {
    if (state.room) {
        state.center.removeChild(state.room.element)
        state.room.destroy()
    }
    if (secret.length < 8) log({ scope: "crypto", warn: true }, PO.warn_short_secret)
    if (secret.split("#").length > 1) document.title = `${secret.split("#")[0]} | keks-meet`
    state.room = new Room(state.conn, state.chat, rtc_config)
    state.chat.room = state.room
    state.conn.join(secret)
    state.room.on_ready = () => {
        state.center.prepend(state.room!.element)
    }
}

export async function main() {
    document.body.append(LOGGER_CONTAINER)
    log("*", "loading client config")
    const config_res = await fetch("/config.json")
    if (!config_res.ok) return log({ scope: "*", error: true }, "cannot load config")
    const config: ClientConfig = await config_res.json()
    log("*", "config loaded. starting")

    init_locale(PREFS.language ?? "en-US")

    document.body.querySelectorAll(".loading").forEach(e => e.remove())

    if (!globalThis.isSecureContext) log({ scope: "*", warn: true }, PO.warn_secure_context)
    if (!globalThis.RTCPeerConnection) return log({ scope: "webrtc", error: true }, PO.warn_no_webrtc)
    if (!globalThis.crypto.subtle) return log({ scope: "crypto", error: true }, PO.warn_no_crypto)
    if (!globalThis.navigator.serviceWorker) log({ scope: "*", warn: true }, PO.warn_no_sw)
    if (PREFS.warn_redirect) log({ scope: "crypto", warn: true }, PO.warn_old_url)

    const sud = e("div", { class: "side-ui" })
    const state: AppState = {
        chat: new Chat(),
        conn: await (new SignalingConnection().connect()),
        center: e("div", { class: "main" }, info_br(), sud)
    };
    document.body.append(state.center, control_bar(state, sud))

    const rtc_config: RTCConfiguration = {
        iceCandidatePoolSize: 10,
        iceServers: [{
            urls: [config.webrtc.stun, ...(config.webrtc.turn ? [config.webrtc.turn] : [])],
            credential: config.webrtc.turn_cred,
            username: config.webrtc.turn_user,
        }]
    }

    setup_keybinds(state)

    const room_secret = load_params().rsecret
    if (room_secret.length != 0) {
        set_room(state, room_secret, rtc_config)
    }
    globalThis.onhashchange = () => {
        const new_secret = load_params().rsecret;
        set_room(state, new_secret, rtc_config)
    }
    globalThis.onbeforeunload = ev => {
        if (state.room && state.room.local_user.resources.size != 0 && PREFS.enable_onbeforeunload) {
            ev.preventDefault()
            return PO.confirm_quit
        }
    }

    if (globalThis.navigator.serviceWorker) init_serviceworker()
}
