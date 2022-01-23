/// <reference lib="dom" />

import { get_query_params } from "./helper.ts"
import { log } from "./logger.ts"
import { Room } from "./room.ts"

export const servers = {
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
    log("*", "starting up")
    if (window.location.pathname.startsWith("/room/")) {
        const room_name = window.location.pathname.substr("/room/".length)
        const room = new Room(room_name)
        document.body.append(room.el)
    } else {
        document.body.append(create_start_screen())
    }
}

function create_start_screen() {
    const el = document.createElement("div")
    const header = document.createElement("h2")
    header.textContent = "keks meet"
    const para = document.createElement("p")
    para.textContent = "Hier kann man dann irgendwann mal sinnvollen text hinschreiben..."

    // const room_input_label = document.createElement("label")
    // room_input_label.textContent = "Room ID: "
    // room_input_label.htmlFor = "room-id-input"

    const room_input = document.createElement("input")
    room_input.type = "text"
    room_input.id = "room-id-input"
    room_input.placeholder = "room id "

    const submit = document.createElement("input")
    submit.type = "button"
    submit.addEventListener("click", () => {
        if (room_input.value.length == 0) room_input.value = Math.floor(Math.random() * 10000).toString(16).padStart(5, "0")
        window.location.pathname = `/room/${encodeURIComponent(room_input.value)}`
    })
    submit.value = "Join room"

    el.classList.add("start-box")
    el.append(header, para, room_input, document.createElement("br"), submit)
    return el
}
