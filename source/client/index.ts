/// <reference lib="dom" />

import { get_query_params } from "./helper.ts"
import { log } from "./logger.ts"
import { create_menu } from "./menu.ts";
import { Room } from "./room.ts"

export const servers: RTCConfiguration = {
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
    if (window.location.pathname.startsWith("/room/")) {
        const room_name = window.location.pathname.substring("/room/".length)
        const room = new Room(room_name)
        create_menu(room)
        document.body.append(room.el)
    } else {
        create_menu()
        document.body.append(create_start_screen())
    }
}

function create_start_screen() {
    const with_text_content = (a: string) => (b: string) => {
        const e = document.createElement(a)
        e.textContent = b
        return e
    }
    const p = with_text_content("p")
    const h2 = with_text_content("h2")

    const el = document.createElement("div")
    el.append(
        h2("keks-meet"),
        p("A web conferencing application using webrtc"),
        p("keks-meet is free! It is licenced under the terms of the third version of the GNU Affero General Public Licence only."),
        p("To get started, just enter a unique idenfier, then share the URL with your partner.")
    )

    const room_input = document.createElement("input")
    room_input.type = "text"
    room_input.id = "room-id-input"
    room_input.placeholder = "room id"

    const submit = document.createElement("input")
    submit.type = "button"
    submit.addEventListener("click", () => {
        if (room_input.value.length == 0) room_input.value = Math.floor(Math.random() * 10000).toString(16).padStart(5, "0")
        window.location.pathname = `/room/${encodeURIComponent(room_input.value)}`
    })
    submit.value = "Join room"

    el.classList.add("start-box")
    el.append(room_input, document.createElement("br"), submit)

    return el
}
