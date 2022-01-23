
import { log } from "./logger.ts"
import { Room } from "./room.ts"
import { TrackHandle } from "./track_handle.ts";


export abstract class User {
    name: string
    room: Room

    el: HTMLElement

    local = false

    protected tracks: Set<TrackHandle> = new Set()

    constructor(room: Room, name: string) {
        this.name = name
        this.room = room
        this.el = document.createElement("div")
        this.el.classList.add("user")
        this.room.el.append(this.el)
        this.setup_view()
    }

    add_track(t: TrackHandle) {
        this.tracks.add(t)
        this.create_track_element(t)
        t.addEventListener("ended", () => {
            log("media", "track ended", t)
            this.tracks.delete(t)
        })
        t.addEventListener("mute", () => {
            log("media", "track muted", t)
        })
        t.addEventListener("unmute", () => {
            log("media", "track unmuted", t)
        })
        //@ts-ignore a
        window.blub = t
        // setTimeout(() => {
        //     console.log("ev");
        //     t.dispatchEvent(new Event("ended"))
        //     // t.dispatchEvent(new MediaStreamTrackEvent("ended", { track: t, bubbles: false, cancelable: true, composed: false }))
        // }, 5000)
    }

    setup_view() {
        const info_el = document.createElement("div")
        info_el.classList.add("info")
        const name_el = document.createElement("span")
        name_el.textContent = this.name
        name_el.classList.add("name")
        info_el.append(name_el)
        this.el.append(info_el)
    }

    create_track_element(t: TrackHandle) {
        const is_video = t.kind == "video"
        const media_el = is_video ? document.createElement("video") : document.createElement("audio")
        media_el.srcObject = new MediaStream([t.track])
        media_el.classList.add("media")
        media_el.autoplay = true
        media_el.controls = true

        if (this.local) media_el.muted = true

        this.el.append(media_el)
        t.addEventListener("ended", () => {
            media_el.remove()
        })
    }
}