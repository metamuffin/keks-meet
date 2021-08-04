import { Room } from "./room"



export class User {
    el: HTMLElement
    el_video: HTMLVideoElement

    name: string
    local: boolean
    peer: RTCPeerConnection
    room: Room
    stream: MediaStream

    constructor(room: Room, name: string, local?: boolean) {
        this.name = name
        this.room = room
        this.local = !!local
        this.stream = new MediaStream()
        this.el = document.createElement("div")
        this.el_video = document.createElement("video")
        this.el.append(this.el_video)
        this.el_video.autoplay = true
        this.el_video.muted = this.local
        this.el_video.setAttribute("playsinline", "1")

        this.peer = new RTCPeerConnection()
        this.peer.onicecandidate = ev => {
            if (!ev.candidate) return
            room.websocket_send({ ice_candiate: ev.candidate.toJSON(), receiver: this.name })
            console.log("sent rtc candidate", ev.candidate);
        }
        this.peer.ontrack = ev => {
            console.log("got remote track", ev.streams);
            ev.streams[0].getTracks().forEach(t => {
                this.stream.addTrack(t)
            })
        }

        if (this.local) this.get_local_media().then(stream => {
            this.stream = stream
            this.el_video.srcObject = stream
        })

        this.room.el.appendChild(this.el)
    }

    async get_local_media(): Promise<MediaStream> {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    }

    add_ice_candidate(candidate: RTCIceCandidateInit) {
        this.peer.addIceCandidate(new RTCIceCandidate(candidate))
    }


    leave() {
        this.room.el.removeChild(this.el)
    }
}