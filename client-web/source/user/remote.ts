/// <reference lib="dom" />

import { RelayMessage } from "../../../common/packets.d.ts";
import { Resource } from "../resource/mod.ts";
import { notify } from "../helper.ts";
import { ROOM_CONTAINER, RTC_CONFIG } from "../index.ts"
import { log } from "../logger.ts"
import { PREFS } from "../preferences/mod.ts";
import { Room } from "../room.ts"
import { TrackHandle } from "../track_handle.ts";
import { User } from "./mod.ts";
import { TrackResource } from "../resource/track.ts";

export class RemoteUser extends User {
    peer: RTCPeerConnection
    senders: Map<string, RTCRtpSender> = new Map()
    data_channels: Map<string, RTCDataChannel> = new Map()

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
            console.log(ev)
            const t = ev.track
            const id = ev.streams[0]?.id
            if (!id) { ev.transceiver.stop(); return log({ scope: "media", warn: true }, "got a track without stream") }
            const r = this.resources.get(id)
            if (!r) { ev.transceiver.stop(); return log({ scope: "media", warn: true }, "got an unassociated track") }
            if (r instanceof TrackResource) r.track = new TrackHandle(t);
            else { ev.transceiver.stop(); return log({ scope: "media", warn: true }, "got a track for a resource that should use data channel") }
            log("media", `remote track: ${this.display_name}`, t)
            this.update_stats()
        }
        this.peer.onnegotiationneeded = () => {
            log("webrtc", `negotiation needed: ${this.display_name}`)
            if (this.negotiation_busy && this.peer.signalingState == "stable") return
            this.offer()
            this.update_stats()
        }
        this.peer.onicecandidateerror = () => {
            log({ scope: "webrtc", warn: true }, "ICE error")
            this.update_stats()
        }
        this.peer.oniceconnectionstatechange = () => { this.update_stats() }
        this.peer.onicegatheringstatechange = () => { this.update_stats() }
        this.peer.onsignalingstatechange = () => { this.update_stats() }
        this.peer.onconnectionstatechange = () => { this.update_stats() }
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
        if (message.provide) {
            console.log(message.provide.id);
            const d = Resource.create(this, message.provide)
            if (!d) return
            if (d instanceof TrackResource) {
                if (d.info.kind == "video" && PREFS.optional_video_default_enable) d.request()
                if (d.info.kind == "audio" && PREFS.optional_audio_default_enable) d.request()
            }
            this.el.append(d.el)
            this.resources.set(message.provide.id, d)
        }
        if (message.provide_stop) {
            this.resources.get(message.provide_stop.id)?.el.remove()
            this.resources.delete(message.provide_stop.id)
        }
        if (message.request) {
            const r = this.room.local_user.resources.get(message.request.id)
            if (!r) return log({ scope: "*", warn: true }, "somebody requested an unknown resource")
            if (r instanceof TrackResource) {
                if (!r.track) throw new Error("local resources not avail");
                const sender = this.peer.addTrack(r.track.track, r.track.stream)
                this.senders.set(r.track.id, sender)
                r.track.addEventListener("end", () => { this.senders.delete(r.track?.id ?? "") })
            }
        }
        if (message.request_stop) {
            const sender = this.senders.get(message.request_stop.id)
            if (!sender) return log({ scope: "*", warn: true }, "somebody requested us to stop transmitting an unknown resource")
            this.peer.removeTrack(sender)
        }
    }
    send_to(message: RelayMessage) {
        this.room.signaling.send_relay(message, this.id)
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
        log("webrtc", `sent offer: ${this.display_name}`, { offer: offer_description.sdp })
        this.send_to({ offer: offer_description.sdp })
    }
    async on_offer(offer: string) {
        this.negotiation_busy = true
        log("webrtc", `got offer: ${this.display_name}`, { offer })
        const offer_description = new RTCSessionDescription({ sdp: offer, type: "offer" })
        await this.peer.setRemoteDescription(offer_description)
        this.answer()
    }
    async answer() {
        const answer_description = await this.peer.createAnswer()
        await this.peer.setLocalDescription(answer_description)
        log("webrtc", `sent answer: ${this.display_name}`, { answer: answer_description.sdp })
        this.send_to({ answer: answer_description.sdp })
        this.negotiation_busy = false
    }
    async on_answer(answer: string) {
        log("webrtc", `got answer: ${this.display_name}`, { answer })
        const answer_description = new RTCSessionDescription({ sdp: answer, type: "answer" })
        await this.peer.setRemoteDescription(answer_description)
        this.negotiation_busy = false
    }

    add_ice_candidate(candidate: RTCIceCandidateInit) {
        this.peer.addIceCandidate(new RTCIceCandidate(candidate))
        this.update_stats()
    }
}