import { parameter_bool, parameter_number } from "./helper.ts";
import { log } from "./logger.ts";
import { RemoteUser } from "./remote_user.ts";
import { get_rnnoise_node } from "./rnnoise.ts";
import { Room } from "./room.ts";
import { User } from "./user.ts";


export class LocalUser extends User {

    private audio_track?: MediaStreamTrack
    private video_track?: MediaStreamTrack
    private audio_disable_cleanup?: () => void

    mic_gain?: GainNode
    default_gain: number = parameter_number("mic_gain", 1)

    controls?: { audio: HTMLElement, video: HTMLElement, mute: HTMLElement }

    constructor(room: Room, name: string) {
        super(room, name)
        this.el.classList.add("local")
        this.local = true
        this.create_controls()
        if (parameter_bool("audio_enabled", false)) this.enable_audio()
        if (parameter_bool("video_enabled", false)) this.enable_video()
    }

    create_controls() {
        const audio_toggle = document.createElement("input")
        const video_toggle = document.createElement("input")
        const mute_toggle = document.createElement("input")
        audio_toggle.type = video_toggle.type = mute_toggle.type = "button"
        audio_toggle.value = "Audio"
        video_toggle.value = "Video"
        mute_toggle.value = "Mute"
        let audio = parameter_bool("audio_enabled", false),
            video = parameter_bool("video_enabled", false),
            mute = parameter_bool("video_enabled", false)


        audio_toggle.addEventListener("click", () => {
            audio = !audio
            if (audio) this.enable_audio()
            else this.disable_audio()
        })
        video_toggle.addEventListener("click", () => {
            video = !video
            if (video) this.enable_video()
            else this.disable_video()
        })
        mute_toggle.addEventListener("click", () => {
            mute = !mute
            this.mic_gain?.gain?.setValueAtTime(mute ? 0 : this.default_gain, 0)
            if (mute) this.controls?.mute.classList.add("enabled")
            else this.controls?.mute.classList.remove("enabled")
        })

        const el = document.createElement("div")
        el.classList.add("local-controls")
        el.append(audio_toggle, video_toggle, mute_toggle)
        this.controls = { video: video_toggle, audio: audio_toggle, mute: mute_toggle }
        document.body.append(el)
    }

    update_view_w() {
        this.update_view()
        if (this.stream.getAudioTracks().length > 0)
            this.controls?.audio.classList.add("enabled")
        else this.controls?.audio.classList.remove("enabled")

        if (this.stream.getVideoTracks().length > 0)
            this.controls?.video.classList.add("enabled")
        else this.controls?.video.classList.remove("enabled")
    }

    add_initial_to_remote(ru: RemoteUser) {
        if (this.audio_track) ru.peer.addTrack(this.audio_track)
        if (this.video_track) ru.peer.addTrack(this.video_track)
    }

    async enable_video() {
        if (this.video_track) return
        log("media", "requesting user media (video)")
        const user_media = await window.navigator.mediaDevices.getUserMedia({ video: true })
        const t = this.video_track = user_media.getVideoTracks()[0]
        this.room.remote_users.forEach(u => u.peer.addTrack(t))
        this.stream.addTrack(t)
        this.update_view_w()
    }
    async enable_audio() {
        if (this.audio_track) return
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

        this.audio_disable_cleanup = () => {
            source.disconnect()
            if (rnnoise) rnnoise.disconnect()
            gain.disconnect()
            destination.disconnect()
            this.mic_gain = undefined
        }

        const t = destination.stream.getAudioTracks()[0]
        this.audio_track = t
        this.room.remote_users.forEach(u => u.peer.addTrack(t))
        this.stream.addTrack(t)
        this.update_view_w()
    }

    disable_video() {
        if (!this.video_track) return
        this.room.remote_users.forEach(u => {
            u.peer.getSenders().forEach(s => {
                if (s.track == this.video_track) u.peer.removeTrack(s)
            })
        })
        this.stream.removeTrack(this.video_track)
        this.update_view_w()
        this.video_track = undefined
    }
    disable_audio() {
        if (!this.audio_track) return
        if (this.audio_disable_cleanup) this.audio_disable_cleanup()
        this.room.remote_users.forEach(u => {
            u.peer.getSenders().forEach(s => {
                if (s.track == this.audio_track) u.peer.removeTrack(s)
            })
        })
        this.stream.removeTrack(this.audio_track)
        this.update_view_w()
        this.audio_track = undefined
    }
}
