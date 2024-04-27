/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2024 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />
import { ProvideInfo } from "../../../common/packets.d.ts";
import { e } from "../helper.ts";
import { PO } from "../locale/mod.ts";
import { log } from "../logger.ts";
import { on_pref_changed, PREFS } from "../preferences/mod.ts";
import { get_rnnoise_node } from "../rnnoise.ts";
import { Room } from "../room.ts";
import { LocalResource, ResourceHandlerDecl } from "./mod.ts";

export const resource_track: ResourceHandlerDecl = {
    kind: "track",
    new_remote: (info, _user, enable) => {
        const enable_label = PO.enable(`"${info.label ?? info.kind}"`)
        const enable_button = e("button", {
            class: "center",
            onclick: self => {
                self.disabled = true;
                self.textContent = PO.status_await_stream;
                enable()
            }
        }, enable_label)

        return {
            info,
            el: e("div", { class: [`media-${info.track_kind}`] }, enable_button),
            on_statechange() { },
            on_preview(preview) {
                if (this.el.querySelector("audio, video")) return
                let pi = this.el.querySelector(".preview") as HTMLImageElement
                if (!pi) {
                    pi = document.createElement("img")
                    pi.classList.add("preview")
                    this.el.prepend(pi)
                }
                if (!preview.startsWith("data:")) return
                pi.src = preview
            },
            on_enable(stream, disable) {
                this.el.removeChild(enable_button)
                if (!(stream instanceof MediaStream)) return console.warn("expected mediastream");
                this.el.append(e("button", {
                    class: ["topright", "abort"],
                    onclick: (self) => {
                        disable()
                        this.el.appendChild(enable_button)
                        self.disabled = true
                        enable_button.disabled = false
                        enable_button.textContent = enable_label;
                        self.remove()
                    }
                }, PO.disable))
                create_track_display(this.el, stream, false)
            },
        }
    }
}

export function new_local_track(info: ProvideInfo, stream: MediaStream, ...extra_controls: HTMLElement[]): LocalResource {
    let destroy: () => void;
    let room: Room;

    const el = e("div", { class: `media-${stream.getVideoTracks().length > 0 ? "video" : "audio"}` },
        e("button", { class: ["abort", "topright"], onclick: () => destroy() }, PO.stop_sharing),
        ...extra_controls
    );

    const generate_previews = (video: HTMLVideoElement) => {
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")!
        context.fillStyle = "#ff00ff"
        setInterval(() => {
            context.fillRect(0, 0, video.videoWidth, video.videoHeight)
            const res = PREFS.preview_resolution
            canvas.width = res
            canvas.height = res
            context.drawImage(video, 0, 0, res, res)
            canvas.toDataURL()
            canvas.toBlob(blob => {
                if (!blob) return log({ error: true, scope: "media" }, "Failed to encode stream preview");
                const reader = new FileReader();
                reader.addEventListener("load", ev => {
                    const data_url = ev.target!.result as string;
                    room.signaling.send_relay({ preview: { id: info.id, data: data_url } })
                })
                reader.readAsDataURL(blob)

            }, "image/webp", PREFS.preview_encoding_quality * 0.01)
        }, 1000 * PREFS.preview_rate)
    }
    create_track_display(el, stream, true, generate_previews)
    return {
        set_room(r) { room = r },
        set_destroy(cb) { destroy = cb },
        info,
        el,
        destroy() {
            stream.dispatchEvent(new Event("ended"));
            stream.getTracks().forEach(t => t.stop())
        },
        on_request(_user, _create_channel) {
            return stream
        }
    }
}

function create_track_display(target: HTMLElement, stream: MediaStream, local: boolean, preview_callback?: (v: HTMLVideoElement) => void): HTMLElement {
    const is_video = stream.getVideoTracks().length > 0
    const is_audio = stream.getAudioTracks().length > 0

    const media_el = is_video
        ? document.createElement("video")
        : document.createElement("audio")

    media_el.srcObject = stream
    media_el.autoplay = true
    media_el.controls = true
    media_el.ariaLabel = is_video ? PO.video_stream : PO.audio_stream
    media_el.addEventListener("pause", () => media_el.play())

    if (local) media_el.muted = true

    target.querySelectorAll("video, audio, .preview").forEach(e => e.remove())
    target.prepend(media_el)

    console.log(stream.getTracks());
    const master = stream.getTracks()[0]
    master.addEventListener("ended", () => {
        // if (is_video) media_el.controls = false
        // media_el.classList.add("media-freeze")
        media_el.remove()
    })

    if (is_video && PREFS.send_previews && local && preview_callback) preview_callback(media_el as HTMLVideoElement)
    if (is_audio && PREFS.audio_activity_threshold !== undefined) check_volume(stream, vol => {
        const active = vol > PREFS.audio_activity_threshold
        if (active != target.classList.contains("audio-active")) {
            if (active) target.classList.add("audio-active")
            else target.classList.remove("audio-active")
        }
    })

    return media_el
}

function check_volume(stream: MediaStream, cb: (vol: number) => void) {
    const ctx = new AudioContext();
    const s = ctx.createMediaStreamSource(stream)
    const a = ctx.createAnalyser()
    s.connect(a)
    const samples = new Float32Array(a.fftSize);
    const interval = setInterval(() => {
        a.getFloatTimeDomainData(samples);
        let sum = 0.0;
        for (const amplitude of samples) { sum += amplitude * amplitude; }
        cb(Math.sqrt(sum / samples.length))
    }, 1000 / 15)
    stream.addEventListener("ended", () => {
        clearInterval(interval)
    })
}

export async function create_camera_res() {
    log("media", "requesting user media (camera)")
    const user_media = await window.navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: { ideal: PREFS.camera_facing_mode },
            frameRate: { ideal: PREFS.video_fps },
            width: { ideal: PREFS.video_resolution }
        },
    })
    return new_local_track({ id: user_media.id, kind: "track", track_kind: "video", label: "Camera" }, user_media)
}

export async function create_screencast_res() {
    log("media", "requesting user media (screen)")
    const user_media = await window.navigator.mediaDevices.getDisplayMedia({
        video: {
            frameRate: { ideal: PREFS.video_fps },
            width: { ideal: PREFS.video_resolution }
        },
        audio: PREFS.screencast_audio
    })
    return new_local_track({ id: user_media.id, kind: "track", track_kind: "video", label: "Screen" }, user_media)
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

    const mute = document.createElement("input")
    mute.type = "checkbox"

    const mute_label = e("label", { class: "check-button" }, PO.mute)
    mute_label.prepend(mute)

    const res = new_local_track({ id: destination.stream.id, kind: "track", track_kind: "audio", label: "Microphone" }, destination.stream, mute_label)
    mute.onchange = () => {
        log("media", mute.checked ? "muted" : "unmuted")
        gain.gain.value = mute.checked ? Number.MIN_VALUE : PREFS.microphone_gain
        if (mute.checked) res.el.classList.add("audio-mute")
        else res.el.classList.remove("audio-mute")
    }

    const old_destroy = res.destroy
    res.destroy = () => {
        user_media.getTracks().forEach(t => t.stop())
        source.disconnect()
        if (rnnoise) rnnoise.disconnect()
        gain.disconnect()
        clear_gain_cb()
        destination.disconnect()
        old_destroy()
    }

    return res
}
