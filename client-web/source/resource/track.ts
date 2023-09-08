/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />
import { ProvideInfo } from "../../../common/packets.d.ts";
import { e } from "../helper.ts";
import { log } from "../logger.ts";
import { on_pref_changed, PREFS } from "../preferences/mod.ts";
import { get_rnnoise_node } from "../rnnoise.ts";
import { TrackHandle } from "../track_handle.ts";
import { LocalResource, ResourceHandlerDecl } from "./mod.ts";

export const resource_track: ResourceHandlerDecl = {
    kind: "track",
    new_remote: (info, _user, enable) => {
        let enable_label = `Enable ${info.track_kind}`
        if (info.label) enable_label += ` "${info.label}"`

        const enable_button = e("button", {
            onclick: self => {
                self.disabled = true;
                self.textContent = "Awaiting track…";
                enable()
            }
        }, enable_label)
        return {
            info,
            el: e("div", {}, enable_button),
            on_statechange() { },
            on_enable(track, disable) {
                this.el.removeChild(enable_button)
                this.el.append(e("button", {
                    onclick: (self) => {
                        disable()
                        this.el.appendChild(enable_button)
                        self.disabled = true
                        enable_button.disabled = false
                        enable_button.textContent = enable_label;
                        self.remove()
                    }
                }, "Disable"))
                if (!(track instanceof TrackHandle)) return console.warn("aservuoivasretuoip");
                this.el.append(create_track_display(track))
            }
        }
    }
}

export function new_local_track(info: ProvideInfo, track: TrackHandle, ...extra_controls: HTMLElement[]): LocalResource {
    return {
        info,
        el: e("div", {},
            create_track_display(track),
            ...extra_controls
        ),
        destroy() { track.end() },
        on_request(_user, _create_channel) {
            return track
        }
    }
}

function create_track_display(track: TrackHandle): HTMLElement {
    const is_video = track.kind == "video"
    const is_audio = track.kind == "audio"

    const stream = new MediaStream([track.track])

    const el = document.createElement("div")

    const media_el = is_video
        ? document.createElement("video")
        : document.createElement("audio")

    media_el.srcObject = stream
    media_el.classList.add("media")
    media_el.autoplay = true
    media_el.controls = true
    media_el.addEventListener("pause", () => media_el.play())

    if (track.local) media_el.muted = true
    el.append(media_el)
    track.addEventListener("ended", () => {
        media_el.srcObject = null // TODO // TODO figure out why i wrote todo here
        el.remove()
    })

    if (is_audio && PREFS.audio_activity_threshold !== undefined) check_volume(stream, vol => {
        const active = vol > PREFS.audio_activity_threshold
        if (active != el.classList.contains("audio-active")) {
            if (active) el.classList.add("audio-active")
            else el.classList.remove("audio-active")
        }
    })

    return el
}

function check_volume(track: MediaStream, cb: (vol: number) => void) {
    const ctx = new AudioContext();
    const s = ctx.createMediaStreamSource(track)
    const a = ctx.createAnalyser()
    s.connect(a)
    const samples = new Float32Array(a.fftSize);
    setInterval(() => {
        a.getFloatTimeDomainData(samples);
        let sum = 0.0;
        for (const amplitude of samples) { sum += amplitude * amplitude; }
        cb(Math.sqrt(sum / samples.length))
    }, 1000 / 15)
}

export async function create_camera_res() {
    log("media", "requesting user media (camera)")
    const user_media = await window.navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: { ideal: PREFS.camera_facing_mode },
            frameRate: { ideal: PREFS.video_fps },
            width: { ideal: PREFS.video_resolution }
        }
    })
    const t = new TrackHandle(user_media.getVideoTracks()[0], true)
    return new_local_track({ id: t.id, kind: "track", track_kind: "video", label: "Camera" }, t)
}

export async function create_screencast_res() {
    log("media", "requesting user media (screen)")
    const user_media = await window.navigator.mediaDevices.getDisplayMedia({
        video: {
            frameRate: { ideal: PREFS.video_fps },
            width: { ideal: PREFS.video_resolution }
        },
    })
    const t = new TrackHandle(user_media.getVideoTracks()[0], true)
    return new_local_track({ id: t.id, kind: "track", track_kind: "video", label: "Screen" }, t)
}

export async function create_mic_res() {
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

    const mute = document.createElement("input")
    mute.type = "checkbox"
    mute.onchange = () => {
        log("media", mute.checked ? "muted" : "unmuted")
        if (mute.checked) gain.gain.value = Number.MIN_VALUE
        else gain.gain.value = PREFS.microphone_gain
    }
    const mute_label = e("label", { class: "check-button" }, "Mute")
    mute_label.prepend(mute)

    return new_local_track({ id: t.id, kind: "track", track_kind: "audio", label: "Microphone" }, t, mute_label)
}
