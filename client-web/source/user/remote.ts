/// <reference lib="dom" />

import { RelayMessage } from "../../../common/packets.d.ts";
import { notify } from "../helper.ts";
import { ROOM_CONTAINER, RTC_CONFIG } from "../index.ts"
import { log } from "../logger.ts"
import { PREFS } from "../preferences/mod.ts";
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
            log("webrtc", `ICE candidate set`, ev.candidate)
            this.update_stats()
        }
        this.peer.ontrack = ev => {
            const t = ev.track
            log("media", `remote track: ${this.display_name}`, t)
            this.add_track(new TrackHandle(t))
            this.update_stats()
        }
        this.peer.onnegotiationneeded = () => {
            log("webrtc", `negotiation needed: ${this.display_name}`)
            if (this.negotiation_busy && this.peer.signalingState == "stable") return
            this.offer()
            this.update_stats()
        }
        this.peer.onicecandidateerror = () => {
            console.log("onicecandidateerror")
            log({ scope: "webrtc", warn: true }, "ICE error")
            this.update_stats()
        }
        this.peer.oniceconnectionstatechange = () => {
            console.log("oniceconnectionstatechange")
            this.update_stats()
        }
        this.peer.onicegatheringstatechange = () => {
            console.log("onicegatheringstatechange")
            this.update_stats()
        }
        this.peer.onsignalingstatechange = () => {
            console.log("onsignalingstatechange")
            this.update_stats()
        }
        this.peer.onconnectionstatechange = () => {
            console.log("onconnectionstatechange")
            this.update_stats()
        }
        this.update_stats()
    }
    leave() {
        log("usermodel", `remove remote user: ${this.display_name}`)
        this.peer.close()
        this.room.remote_users.delete(this.id)
        super.leave()
        ROOM_CONTAINER.removeChild(this.el)
        if (PREFS.notify_leave) notify(`${this.display_name} left`)
    }

    on_relay(message: RelayMessage) {
        if (message.chat) this.room.chat.add_message(this, message.chat)
        if (message.ice_candidate) this.add_ice_candidate(message.ice_candidate)
        if (message.offer) this.on_offer(message.offer)
        if (message.answer) this.on_answer(message.answer)
        if (message.identify) {
            this.name = message.identify.username
            if (PREFS.notify_join) notify(`${this.display_name} joined`)
        }
    }

    async update_stats() {
        if (!PREFS.webrtc_debug) return
        try {
            const stats = await this.peer.getStats()
            let stuff = "";
            stuff += `ice-conn=${this.peer.iceConnectionState}; ice-gathering=${this.peer.iceGatheringState}; ice-trickle=${this.peer.canTrickleIceCandidates}; signaling=${this.peer.signalingState};\n`
            stats.forEach(s => {
                console.log("stat", s);
                if (s.type == "candidate-pair" && s.selected) {
                    //@ts-ignore spec is weird....
                    if (!stats.get) return console.warn("no RTCStatsReport.get");
                    //@ts-ignore spec is weird....
                    const cpstat = stats.get(s.localCandidateId)
                    if (!cpstat) return console.warn("no stats");
                    console.log("cp", cpstat);
                    stuff += `via ${cpstat.candidateType}:${cpstat.protocol}:${cpstat.address}\n`
                } else if (s.type == "codec") {
                    stuff += `using ${s.codecType ?? "dec/enc"}:${s.mimeType}(${s.sdpFmtpLine})\n`
                }
            })
            this.stats_el.textContent = stuff
        } catch (e) {
            console.warn(e);
        }
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
        this.update_stats()
    }
}