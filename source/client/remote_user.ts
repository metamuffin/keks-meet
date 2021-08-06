import { log } from "./logger"
import { Room } from "./room"
import { User } from "./user"



export class RemoteUser extends User {
    peer: RTCPeerConnection
    negotiation_busy: boolean = false

    constructor(room: Room, name: string) {
        super(room, name)
        this.peer = new RTCPeerConnection()
        this.peer.onicecandidate = ev => {
            if (!ev.candidate) return
            room.websocket_send({ ice_candiate: ev.candidate.toJSON(), receiver: this.name })
        }
        this.peer.ontrack = ev => {
            log("media", "remote track", ev.streams)
            console.log(ev.track);
            this.stream.addTrack(ev.track)
            // if (!ev.streams.length) return console.warn("no remote tracks")
            // ev.streams.forEach(s => s.getTracks().forEach(t => {
            //     this.stream.addTrack(t)
            // }))
            this.update_view()
        }
        this.peer.onnegotiationneeded = async () => {
            log("webrtc", "negotiation needed")
            while (this.negotiation_busy) {
                await new Promise<void>(r => setTimeout(() => r(), 100))
            }
            this.offer()
        }
    }


    async offer() {
        this.negotiation_busy = true
        const offer_description = await this.peer.createOffer()
        await this.peer.setLocalDescription(offer_description)
        const offer = { type: offer_description.type, sdp: offer_description.sdp }
        log("webrtc", "sent offer", offer)
        this.room.websocket_send({ receiver: this.name, offer })
    }
    async on_offer(offer: RTCSessionDescriptionInit) {
        this.negotiation_busy = true
        log("webrtc", "got offer", offer)
        const offer_description = new RTCSessionDescription(offer)
        await this.peer.setRemoteDescription(offer_description)
        this.answer()
    }
    async answer() {
        const answer_description = await this.peer.createAnswer()
        await this.peer.setLocalDescription(answer_description)
        const answer = { type: answer_description.type, sdp: answer_description.sdp }
        log("webrtc", "sent answer", answer)
        this.room.websocket_send({ receiver: this.name, answer })
        this.negotiation_busy = false
    }
    async on_answer(answer: RTCSessionDescriptionInit) {
        log("webrtc", "got answer", answer)
        const answer_description = new RTCSessionDescription(answer)
        await this.peer.setRemoteDescription(answer_description)
        this.negotiation_busy = false
    }

    add_ice_candidate(candidate: RTCIceCandidateInit) {
        this.peer.addIceCandidate(new RTCIceCandidate(candidate))
    }

    leave() {
        this.peer.close()
        this.room.el.removeChild(this.el)
    }
}