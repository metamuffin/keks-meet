/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { RelayMessage } from "../../../common/packets.d.ts";
import { notify } from "../helper.ts";
import { ROOM_CONTAINER, RTC_CONFIG } from "../index.ts"
import { log } from "../logger.ts"
import { PREFS } from "../preferences/mod.ts";
import { new_remote_resource, RemoteResource } from "../resource/mod.ts";
import { Room } from "../room.ts"
import { TrackHandle } from "../track_handle.ts";
import { User } from "./mod.ts";

export class RemoteUser extends User {
    pc: RTCPeerConnection
    senders: Map<string, RTCRtpSender> = new Map()
    data_channels: Map<string, RTCDataChannel> = new Map()
    resources: Map<string, RemoteResource> = new Map()

    negotiation_busy = false

    constructor(room: Room, id: number) {
        super(room, id)
        room.remote_users.set(id, this)

        log("usermodel", `added remote user: ${this.display_name}`)
        this.pc = new RTCPeerConnection(RTC_CONFIG)
        this.pc.onicecandidate = ev => {
            if (!ev.candidate) return
            room.signaling.send_relay({ ice_candidate: ev.candidate.toJSON() }, this.id)
            log("webrtc", `ICE candidate set`, ev.candidate)
            this.update_stats()
        }
        this.pc.ontrack = ev => {
            const t = ev.track
            const id = ev.streams[0]?.id
            if (!id) { ev.transceiver.stop(); return log({ scope: "media", warn: true }, "got a track without stream") }
            const r = this.resources.get(id)
            if (!r) { ev.transceiver.stop(); return log({ scope: "media", warn: true }, "got an unassociated track") }
            r.on_enable(new TrackHandle(t), () => {
                this.request_resource_stop(r)
                ev.transceiver.stop()
            })
            log("media", `remote track: ${this.display_name}`, t)
            this.update_stats()
        }
        this.pc.ondatachannel = ({ channel }) => {
            const id = channel.label
            const r = this.resources.get(id)
            if (!r) { channel.close(); return log({ scope: "media", warn: true }, "got an unassociated channel") }
            r.on_enable(channel, () => {
                this.request_resource_stop(r)
                channel.close()
            })
            log("media", `remote channel: ${this.display_name}`, channel)
            this.update_stats()
        }
        this.pc.onnegotiationneeded = () => {
            log("webrtc", `negotiation needed: ${this.display_name}`)
            // if (this.pc.signalingState != "stable") return
            this.offer()
            this.update_stats()
        }
        this.pc.onicecandidateerror = () => {
            log({ scope: "webrtc", warn: true }, "ICE error")
            this.update_stats()
        }
        this.pc.oniceconnectionstatechange = () => { this.update_stats() }
        this.pc.onicegatheringstatechange = () => { this.update_stats() }
        this.pc.onsignalingstatechange = () => { this.update_stats() }
        this.pc.onconnectionstatechange = () => { this.update_stats() }
        this.update_stats()
    }
    leave() {
        log("usermodel", `remove remote user: ${this.display_name}`)
        this.pc.close()
        this.room.remote_users.delete(this.id)
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
            const d = new_remote_resource(this, message.provide)
            if (!d) return
            if (d.info.kind == "track" && d.info.track_kind == "audio" && PREFS.optional_audio_default_enable) this.request_resource(d)
            if (d.info.kind == "track" && d.info.track_kind == "video" && PREFS.optional_video_default_enable) this.request_resource(d)
            d.el.classList.add("resource")
            d.el.classList.add(`resource-${d.info.kind}`)
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
            const channel = r.on_request(this, () => this.pc.createDataChannel(r.info.id))
            if (channel instanceof TrackHandle) {
                const sender = this.pc.addTrack(channel.track, channel.stream)
                this.senders.set(channel.id, sender)
                channel.addEventListener("end", () => { this.senders.delete(r.info.id) })
            } else if (channel instanceof RTCDataChannel) {
                this.data_channels.set(r.info.id, channel)
                channel.addEventListener("close", () => this.data_channels.delete(r.info.id))
            } else throw new Error("unreachable");
        }
        if (message.request_stop) {
            const sender = this.senders.get(message.request_stop.id)
            if (sender) this.pc.removeTrack(sender)
            const dc = this.data_channels.get(message.request_stop.id)
            if (dc) dc.close()
        }
    }
    send_to(message: RelayMessage) {
        this.room.signaling.send_relay(message, this.id)
    }
    request_resource(r: RemoteResource) { this.send_to({ request: { id: r.info.id } }) }
    request_resource_stop(r: RemoteResource) { this.send_to({ request_stop: { id: r.info.id } }) }

    add_ice_candidate(candidate: RTCIceCandidateInit) {
        this.pc.addIceCandidate(new RTCIceCandidate(candidate))
        this.update_stats()
    }
    async offer() {
        this.negotiation_busy = true
        const offer_description = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer_description)
        log("webrtc", `sent offer: ${this.display_name}`, { offer: offer_description.sdp })
        this.send_to({ offer: offer_description.sdp })
    }
    async on_offer(offer: string) {
        this.negotiation_busy = true
        log("webrtc", `got offer: ${this.display_name}`, { offer })
        const offer_description = new RTCSessionDescription({ sdp: offer, type: "offer" })
        await this.pc.setRemoteDescription(offer_description)
        this.answer()
    }
    async answer() {
        const answer_description = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer_description)
        log("webrtc", `sent answer: ${this.display_name}`, { answer: answer_description.sdp })
        this.send_to({ answer: answer_description.sdp })
        this.negotiation_busy = false
    }
    async on_answer(answer: string) {
        log("webrtc", `got answer: ${this.display_name}`, { answer })
        const answer_description = new RTCSessionDescription({ sdp: answer, type: "answer" })
        await this.pc.setRemoteDescription(answer_description)
        this.negotiation_busy = false
    }

    async update_stats() {
        if (!PREFS.webrtc_debug) return
        try {
            const stats = await this.pc.getStats()
            let stuff = "";
            stuff += `ice-conn=${this.pc.iceConnectionState}; ice-gathering=${this.pc.iceGatheringState}; ice-trickle=${this.pc.canTrickleIceCandidates}; signaling=${this.pc.signalingState};\n`
            stats.forEach(s => {
                if (s.type == "candidate-pair" && s.selected) {
                    //@ts-ignore trust me, this works
                    if (!stats.get) return console.warn("no RTCStatsReport.get");
                    //@ts-ignore trust me, this works
                    const cpstat = stats.get(s.localCandidateId)
                    if (!cpstat) return console.warn("no stats");
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
}