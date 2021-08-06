import { log } from "./logger"
import { Room } from "./room"

export const servers = {
    iceServers: [{ urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }],
    iceCandidatePoolSize: 10,
}

export interface User {
    peer: RTCPeerConnection
    stream: MediaStream,
}

export const users: Map<string, User> = new Map()


window.onload = () => main()

export async function main() {
    if (window.location.pathname.startsWith("/room/")) {
        const room_name = window.location.pathname.substr("/room/".length)
        let room = new Room(room_name)
        document.body.append(room.el)
    } else {
        //TODO show ui for joining rooms
    }
}
