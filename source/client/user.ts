import { log } from "./logger"
import { Room } from "./room"


export abstract class User {
    name: string
    room: Room

    el: HTMLElement
    media_el?: HTMLElement

    display?: { audio_status_el: HTMLElement, video_status_el: HTMLElement }

    local: boolean = false

    stream: MediaStream = new MediaStream()

    constructor(room: Room, name: string) {
        this.name = name
        this.room = room
        this.el = document.createElement("div")
        this.el.classList.add("user")
        this.room.el.append(this.el)
        this.setup_view()
        this.update_view()
    }

    add_track(t: MediaStreamTrack) {
        this.stream.addTrack(t)
        this.update_view()
        t.onended = () => {
            log("media", "track ended", t)
            this.stream.removeTrack(t)
            this.update_view()
        }
        t.onmute = () => {
            log("media", "track muted", t)
            this.stream.removeTrack(t)
            this.update_view()
        }
        t.onunmute = () => {
            log("media", "track unmuted", t)
            this.stream.addTrack(t)
            this.update_view()
        }
    }

    setup_view() {
        const info_el = document.createElement("div")
        info_el.classList.add("info")
        const name_el = document.createElement("span")
        name_el.textContent = this.name
        name_el.classList.add("name")
        const audio_status_el = document.createElement("span")
        const video_status_el = document.createElement("span")
        video_status_el.classList.add("status", "video-status")
        audio_status_el.classList.add("status", "audio-status")
        audio_status_el.textContent = "A"
        video_status_el.textContent = "V"
        info_el.append(audio_status_el, video_status_el, name_el)
        this.display = { video_status_el, audio_status_el }
        this.el.append(info_el)
    }

    update_view() {
        if (this.stream.getAudioTracks().length > 0)
            this.display?.audio_status_el.classList.add("enabled")
        else this.display?.audio_status_el.classList.remove("enabled")

        if (this.stream.getVideoTracks().length > 0)
            this.display?.video_status_el.classList.add("enabled")
        else this.display?.video_status_el.classList.remove("enabled")

        if (this.media_el) this.el.removeChild(this.media_el)
        this.media_el = this.create_media_view()
        this.el.appendChild(this.media_el)
    }

    create_media_view() {
        const has_video = this.stream.getVideoTracks().length > 0
        const has_audio = this.stream.getAudioTracks().length > 0
        const media_el = has_video ? document.createElement("video") : document.createElement("audio")
        media_el.classList.add("media")
        media_el.autoplay = true
        if (has_video) media_el.toggleAttribute("playsinline")
        media_el.srcObject = this.stream
        if (has_video) media_el.addEventListener("click", () => {
            media_el.classList.remove("maximized")
        })

        const controls_el = document.createElement("div")
        controls_el.classList.add("media-controls")
        if (has_video) {
            const pip_el = document.createElement("input")
            pip_el.type = "button"
            pip_el.addEventListener("click", () => {
                //@ts-ignore
                media_el.requestPictureInPicture()
            })
            pip_el.value = "Picture-in-Picture"
            const max_el = document.createElement("input")
            max_el.type = "button"
            max_el.addEventListener("click", () => {
                media_el.classList.add("maximized")
            })
            max_el.value = "Maximize"
            controls_el.append(max_el, pip_el)
        }
        if (has_audio) {
            // TODO volume controls
        }

        const el = document.createElement("div")
        el.classList.add("media-container")
        el.append(media_el, controls_el)
        return el
    }
}