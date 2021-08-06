import { parameter_bool, parameter_string } from "./helper";
import { log } from "./logger";
import { RemoteUser } from "./remote_user";
import { rnnoise_track } from "./rnnoise";
import { Room } from "./room";
import { User } from "./user";


export class LocalUser extends User {

    private audio_track?: MediaStreamTrack
    private video_track?: MediaStreamTrack

    controls?: { audio: HTMLElement, video: HTMLElement }

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
        audio_toggle.type = video_toggle.type = "button"
        audio_toggle.value = "Audio"
        video_toggle.value = "Video"
        let audio = false, video = false

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

        const el = document.createElement("div")
        el.classList.add("local-controls")
        el.append(audio_toggle, video_toggle)
        this.controls = { video: video_toggle, audio: audio_toggle }
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

    async add_initial_to_remote(ru: RemoteUser) {
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
        let t = user_media.getAudioTracks()[0]

        if (use_rnnoise) {
            t = await rnnoise_track(t)
        }

        this.audio_track = t
        this.room.remote_users.forEach(u => u.peer.addTrack(t))
        this.stream.addTrack(t)
        this.update_view_w()
    }
    async disable_video() {
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
    async disable_audio() {
        if (!this.audio_track) return
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