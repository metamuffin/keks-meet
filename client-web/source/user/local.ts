/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { log } from "../logger.ts";
import { on_pref_changed, PREFS } from "../preferences/mod.ts";
import { RemoteUser } from "./remote.ts";
import { get_rnnoise_node } from "../rnnoise.ts";
import { Room } from "../room.ts";
import { TrackHandle } from "../track_handle.ts";
import { User } from "./mod.ts";
import { ediv } from "../helper.ts";
import { ChatMessage, ProvideInfo } from "../../../common/packets.d.ts";
import { TrackResource } from "../resource/track.ts";
import { Resource } from "../resource/mod.ts";

export class LocalUser extends User {
    constructor(room: Room, id: number) {
        super(room, id)
        this.el.classList.add("local")
        this.local = true
        this.name = PREFS.username
        this.create_controls()
        this.add_initial_tracks()
        log("usermodel", `added local user: ${this.display_name}`)
    }
    leave() { throw new Error("local users cant leave"); }

    add_initial_tracks() {
        if (PREFS.microphone_enabled) this.await_add_resource(this.create_mic_res())
        if (PREFS.camera_enabled) this.await_add_resource(this.create_camera_res())
        if (PREFS.screencast_enabled) this.await_add_resource(this.create_screencast_res())
    }

    provide_initial_to_remote(u: RemoteUser) {
        this.resources.forEach(r => {
            this.room.signaling.send_relay({ provide: r.info }, u.id)
        })
    }

    identify(recipient?: number) {
        if (this.name) this.room.signaling.send_relay({ identify: { username: this.name } }, recipient)
    }

    chat(message: ChatMessage) {
        this.room.signaling.send_relay({ chat: message })
    }

    create_controls() {
        const mic_toggle = document.createElement("input")
        const camera_toggle = document.createElement("input")
        const screen_toggle = document.createElement("input")
        mic_toggle.type = camera_toggle.type = screen_toggle.type = "button"
        mic_toggle.value = "Microphone"
        camera_toggle.value = "Camera"
        screen_toggle.value = "Screencast"
        mic_toggle.addEventListener("click", () => this.await_add_resource(this.create_mic_res()))
        camera_toggle.addEventListener("click", () => this.await_add_resource(this.create_camera_res()))
        screen_toggle.addEventListener("click", () => this.await_add_resource(this.create_screencast_res()))
        return ediv({ class: "local-controls" }, mic_toggle, camera_toggle, screen_toggle)
    }
    async await_add_resource(tp: Promise<Resource>) {
        log("media", "awaiting track")
        let t!: Resource;
        try { t = await tp }
        catch (_) { log("media", "request failed") }
        if (!t) return
        log("media", "got track")
        this.add_resource(t)
    }

    add_resource(r: Resource) {
        this.resources.set(r.info.id, r)
        this.el.append(r.el)
        const provide: ProvideInfo = r.info
        this.room.signaling.send_relay({ provide })
        r.on_destroy = () => {
            this.el.removeChild(r.el);
            this.room.signaling.send_relay({ provide_stop: { id: r.info.id } })
        }
    }

    async create_camera_res() {
        log("media", "requesting user media (camera)")
        const user_media = await window.navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: PREFS.camera_facing_mode },
                frameRate: { ideal: PREFS.video_fps },
                width: { ideal: PREFS.video_resolution }
            }
        })
        const t = new TrackHandle(user_media.getVideoTracks()[0], true)
        return new TrackResource(this, { id: t.id, kind: "video", label: "Camera" }, t)
    }

    async create_screencast_res() {
        log("media", "requesting user media (screen)")
        const user_media = await window.navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: { ideal: PREFS.video_fps },
                width: { ideal: PREFS.video_resolution }
            },
        })
        const t = new TrackHandle(user_media.getVideoTracks()[0], true)
        return new TrackResource(this, { id: t.id, kind: "video", label: "Screen" }, t)
    }

    async create_mic_res() {
        log("media", "requesting user media (audio)")
        const user_media = await window.navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: { ideal: 1 },
                noiseSuppression: { ideal: PREFS.rnnoise ? false : PREFS.native_noise_suppression },
                echoCancellation: { ideal: PREFS.echo_cancellation },
                autoGainControl: { ideal: PREFS.auto_gain_control },
            }
        })
        const context = new AudioContext()
        const source = context.createMediaStreamSource(user_media)
        const destination = context.createMediaStreamDestination()
        const gain = context.createGain()
        gain.gain.value = PREFS.microphone_gain
        const clear_gain_cb = on_pref_changed("microphone_gain", () => gain.gain.value = PREFS.microphone_gain)

        let rnnoise: RNNoiseNode;
        if (PREFS.rnnoise) {
            rnnoise = await get_rnnoise_node(context)
            source.connect(rnnoise)
            rnnoise.connect(gain)
        } else {
            source.connect(gain)
        }
        gain.connect(destination)

        const t = new TrackHandle(destination.stream.getAudioTracks()[0], true)
        t.addEventListener("ended", () => {
            user_media.getTracks().forEach(t => t.stop())
            source.disconnect()
            if (rnnoise) rnnoise.disconnect()
            gain.disconnect()
            clear_gain_cb()
            destination.disconnect()
        })
        return new TrackResource(this, { id: t.id, kind: "audio", label: "Microphone" }, t)
    }
}
