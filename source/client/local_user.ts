import { parameter_bool, parameter_number } from "./helper.ts";
import { log } from "./logger.ts";
import { RemoteUser } from "./remote_user.ts";
import { get_rnnoise_node } from "./rnnoise.ts";
import { Room } from "./room.ts";
import { TrackHandle } from "./track_handle.ts";
import { User } from "./user.ts";


export class LocalUser extends User {
    mic_gain?: GainNode
    default_gain: number = parameter_number("mic_gain", 1)

    constructor(room: Room, name: string) {
        super(room, name)
        this.el.classList.add("local")
        this.local = true
        this.create_controls()
        this.add_initial_tracks()
    }

    async add_initial_tracks() {
        if (parameter_bool("mic_enabled", false)) this.publish_track(await this.create_mic_track())
        if (parameter_bool("camera_enabled", false)) this.publish_track(await this.create_camera_track())
        if (parameter_bool("screen_enabled", false)) this.publish_track(await this.create_screen_track())
    }

    publish_track(t: TrackHandle) {
        this.room.remote_users.forEach(u => u.peer.addTrack(t.track))
        this.add_track(t)
        t.addEventListener("ended", () => {
            this.room.remote_users.forEach(u => {
                u.peer.getSenders().forEach(s => {
                    if (s.track == t.track) u.peer.removeTrack(s)
                })
            })
        })
    }

    add_initial_to_remote(u: RemoteUser) {
        this.tracks.forEach(t => u.peer.addTrack(t.track))
    }

    create_controls() {
        const mic_toggle = document.createElement("input")
        const camera_toggle = document.createElement("input")
        const screen_toggle = document.createElement("input")
        mic_toggle.type = camera_toggle.type = screen_toggle.type = "button"
        mic_toggle.value = "Microphone"
        camera_toggle.value = "Camera"
        screen_toggle.value = "Screen"

        const create = async (_e: HTMLElement, tp: Promise<TrackHandle>) => {
            log("media", "awaiting track")
            const t = await tp
            log("media", "got track")
            this.publish_track(t)
        }

        mic_toggle.addEventListener("click", () => create(mic_toggle, this.create_mic_track()))
        camera_toggle.addEventListener("click", () => create(camera_toggle, this.create_camera_track()))
        screen_toggle.addEventListener("click", () => create(screen_toggle, this.create_screen_track()))

        const el = document.createElement("div")
        el.classList.add("local-controls")
        el.append(mic_toggle, camera_toggle, screen_toggle)
        document.body.append(el)
    }


    async create_camera_track() {
        log("media", "requesting user media (camera)")
        const user_media = await window.navigator.mediaDevices.getUserMedia({ video: true })
        return new TrackHandle(user_media.getVideoTracks()[0], true)
    }
    async create_screen_track() {
        log("media", "requesting user media (screen)")
        const user_media = await window.navigator.mediaDevices.getDisplayMedia({ video: true })
        return new TrackHandle(user_media.getVideoTracks()[0], true)
    }
    async create_mic_track() {
        log("media", "requesting user media (audio)")
        const use_rnnoise = parameter_bool("rnnoise", true)
        const audio_contraints = use_rnnoise ? {
            channelCount: { ideal: 1 },
            noiseSuppression: { ideal: false },
            echoCancellation: { ideal: true },
            autoGainControl: { ideal: false },
        } : true;

        const user_media = await window.navigator.mediaDevices.getUserMedia({ audio: audio_contraints })
        const context = new AudioContext()
        const source = context.createMediaStreamSource(user_media)
        const destination = context.createMediaStreamDestination()
        const gain = context.createGain()
        gain.gain.value = this.default_gain
        this.mic_gain = gain

        let rnnoise: RNNoiseNode;
        if (use_rnnoise) {
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
            destination.disconnect()
            this.mic_gain = undefined
        })

        return t
    }
}
