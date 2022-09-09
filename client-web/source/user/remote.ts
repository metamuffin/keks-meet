/// <reference lib="dom" />

import { RelayMessage } from "../../../common/packets.d.ts";
import { ROOM_CONTAINER, RTC_CONFIG } from "../index.ts"
import { log } from "../logger.ts"
import { Room } from "../room.ts"
import { TrackHandle } from "../track_handle.ts";
import { User } from "./mod.ts"

export class RemoteUser extends User {
    peer: RTCPeerConnection
    negotiation_busy = false

    constructor(room: Room, id: number) {
        super(room, id)
        room.remote_users.set(this.id, this)

        log("usermodel", `added remote user: ${this.display_name}`)
        this.peer = new RTCPeerConnection(RTC_CONFIG)
        this.peer.onicecandidate = ev => {
            if (!ev.candidate) return
            room.signaling.send_relay({ ice_candidate: ev.candidate.toJSON() }, this.id)
        }
        this.peer.ontrack = ev => {
            const t = ev.track
            log("media", `remote track: ${this.display_name}`, t)
            this.add_track(new TrackHandle(t))
        }
        this.peer.onnegotiationneeded = async () => {
            log("webrtc", `negotiation needed: ${this.display_name}`)
            while (this.negotiation_busy) {
                await new Promise<void>(r => setTimeout(() => r(), 100))
            }
            this.offer()
        }
    }
    leave() {
        log("usermodel", `remove remote user: ${this.display_name}`)
        this.peer.close()
        this.room.remote_users.delete(this.id)
        super.leave()
        ROOM_CONTAINER.removeChild(this.el)
    }

    on_relay(message: RelayMessage) {
        if (message.chat) this.room.chat.send_message(this, message.chat.content)
        if (message.ice_candidate) this.add_ice_candidate(message.ice_candidate)
        if (message.offer) this.on_offer(message.offer)
        if (message.answer) this.on_answer(message.answer)
        if (message.identify) this.name = message.identify.username
    }

    async offer() {
        this.negotiation_busy = true
        const offer_description = await this.peer.createOffer()
        await this.peer.setLocalDescription(offer_description)
        const offer = { type: offer_description.type, sdp: offer_description.sdp }
        log("webrtc", `sent offer: ${this.display_name}`, { offer })
        this.room.signaling.send_relay({ offer }, this.id)
    }
    async on_offer(offer: RTCSessionDescriptionInit) {
        this.negotiation_busy = true
        log("webrtc", `got offer: ${this.display_name}`, { offer })
        const offer_description = new RTCSessionDescription(offer)
        await this.peer.setRemoteDescription(offer_description)
        this.answer()
    }
    async answer() {
        const answer_description = await this.peer.createAnswer()
        await this.peer.setLocalDescription(answer_description)
        const answer = { type: answer_description.type, sdp: answer_description.sdp }
        log("webrtc", `sent answer: ${this.display_name}`, { answer })
        this.room.signaling.send_relay({ answer }, this.id)
        this.negotiation_busy = false
    }
    async on_answer(answer: RTCSessionDescriptionInit) {
        log("webrtc", `got answer: ${this.display_name}`, { answer })
        const answer_description = new RTCSessionDescription(answer)
        await this.peer.setRemoteDescription(answer_description)
        this.negotiation_busy = false
    }

    add_ice_candidate(candidate: RTCIceCandidateInit) {
        this.peer.addIceCandidate(new RTCIceCandidate(candidate))
    }
}