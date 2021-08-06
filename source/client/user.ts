import { log } from "./logger"
import { Room } from "./room"


export abstract class User {
    name: string
    room: Room

    el: HTMLElement
    view_el?: HTMLElement

    local: boolean = false

    stream: MediaStream = new MediaStream()

    constructor(room: Room, name: string) {
        this.name = name
        this.room = room
        this.el = document.createElement("div")
        this.room.el.append(this.el)
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

    update_view() {
        if (this.view_el) this.el.removeChild(this.view_el)
        this.view_el = this.create_view()
        this.el.appendChild(this.view_el)
    }

    create_view() {
        const el = document.createElement("video")
        el.autoplay = true
        el.toggleAttribute("playsinline")
        el.srcObject = this.stream
        console.log(el);

        return el
    }
}