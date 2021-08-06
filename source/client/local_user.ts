import { log } from "./logger";
import { RemoteUser } from "./remote_user";
import { Room } from "./room";
import { User } from "./user";


export class LocalUser extends User {

    private audio_track?: MediaStreamTrack
    private video_track?: MediaStreamTrack

    controls: { audio?: HTMLElement, video?: HTMLElement } = {}

    constructor(room: Room, name: string) {
        super(room, name)
        this.el.classList.add("local")
        this.create_controls()
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
        document.body.append(el)
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
        this.update_view()
    }
    async enable_audio() {
        if (this.audio_track) return
        log("media", "requesting user media (audio)")
        const user_media = await window.navigator.mediaDevices.getUserMedia({ audio: true })
        const t = this.audio_track = user_media.getAudioTracks()[0]
        this.room.remote_users.forEach(u => u.peer.addTrack(t))
        this.stream.addTrack(t)
        this.update_view()
    }
    async disable_video() {
        if (!this.video_track) return
        this.room.remote_users.forEach(u => {
            u.peer.getSenders().forEach(s => {
                if (s.track == this.video_track) u.peer.removeTrack(s)
            })
        })
        this.stream.removeTrack(this.video_track)
        this.update_view()
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
        this.update_view()
        this.audio_track = undefined
    }

}