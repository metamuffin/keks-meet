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

export var local_media: MediaStream


export async function main() {
    await init_local_media()
    if (window.location.pathname.startsWith("/room/")) {
        const room_name = window.location.pathname.substr("/room/".length)
        let room = new Room(room_name)
        document.body.append(room.el)
    } else {
        //TODO show ui for joining rooms
    }
}

export async function init_local_media() {
    log("media", "requesting user media")
    local_media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    log("media", `got ${local_media.getTracks().length} local streams"`, local_media.getTracks())
}




// async function setup_webrtc() {
//     document.body.innerHTML = ""

//     pc = new RTCPeerConnection(servers)

//     local_stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
//     remote_stream = new MediaStream()

//     local_stream.getTracks().forEach(t => pc.addTrack(t, local_stream))

//     pc.ontrack = ev => {
//         console.log("peer got remote tracks", ev.streams);
//         ev.streams[0].getTracks().forEach(t => remote_stream.addTrack(t))
//     }


//     const ls_el = document.createElement("video")
//     const rs_el = document.createElement("video")
//     ls_el.muted = true
//     ls_el.autoplay = rs_el.autoplay = true
//     ls_el.setAttribute("playsinline", "1")
//     rs_el.setAttribute("playsinline", "1")
//     ls_el.srcObject = local_stream
//     rs_el.srcObject = remote_stream

//     document.body.append(ls_el, rs_el)

// }

// interface Offer {
//     sdp: any,
//     type: any
// }

// async function offer(id: string) {
//     const ws = new WebSocket(`ws://${window.location.host}/offer/${id}`)
//     ws.onclose = ev => console.log("websocket closed: " + ev.reason);
//     await new Promise<void>(r => ws.onopen = () => r())

//     console.log("websocket opened")

//     pc.onicecandidate = ev => {
//         const candidate = ev.candidate?.toJSON()
//         if (!candidate) return
//         ws.send(JSON.stringify({ candidate }))
//         console.log("sent ice candidate", ev.candidate);
//     }

//     const offer_description = await pc.createOffer()
//     await pc.setLocalDescription(offer_description);

//     const offer: Offer = { sdp: offer_description.sdp, type: offer_description.type };

//     ws.send(JSON.stringify({ offer }))

//     ws.onmessage = ev => {
//         const s = JSON.parse(ev.data)
//         if (s.answer) {
//             console.log("got answer", s.answer);
//             const answer_description = new RTCSessionDescription(s.answer)
//             pc.setRemoteDescription(answer_description)
//         }
//         if (s.candidate) {
//             console.log("got candidate", s.candidate);
//             const candidate = new RTCIceCandidate(s.candidate)
//             pc.addIceCandidate(candidate)
//         }
//     }

// }

// async function answer(id: string) {
//     const ws = new WebSocket(`ws://${window.location.host}/answer/${id}`)
//     ws.onclose = ev => console.log("websocket closed: " + ev.reason);
//     await new Promise<void>(r => ws.onopen = () => r())
//     console.log("websocket opened");


//     pc.onicecandidate = ev => {
//         const candidate = ev.candidate?.toJSON()
//         if (!candidate) return
//         ws.send(JSON.stringify({ candidate }))
//         console.log("sent ice candidate", candidate);
//     }

//     ws.onmessage = async ev => {
//         const s = JSON.parse(ev.data)
//         if (s.offer) {
//             console.log("got offer", s.offer);
//             await pc.setRemoteDescription(new RTCSessionDescription(s.offer))

//             const answer_description = await pc.createAnswer()
//             await pc.setLocalDescription(answer_description)

//             const answer: Offer = { type: answer_description.type, sdp: answer_description.sdp }
//             ws.send(JSON.stringify({ answer }))
//         }
//         if (s.candidate) {
//             console.log("got candidate", s.candidate);
//             pc.addIceCandidate(new RTCIceCandidate(s.candidate))
//         }
//     }
// }
