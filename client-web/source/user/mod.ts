/// <reference lib="dom" />

import { epre, espan } from "../helper.ts";
import { ROOM_CONTAINER } from "../index.ts";
import { log } from "../logger.ts"
import { Room } from "../room.ts"
import { TrackHandle } from "../track_handle.ts";


export abstract class User {
    protected el: HTMLElement
    public local = false
    public tracks: Set<TrackHandle> = new Set()

    private name_el = espan("")
    protected stats_el = epre("", { class: "stats" })
    private _name?: string
    get name() { return this._name }
    set name(n: string | undefined) { this._name = n; this.name_el.textContent = this.display_name }
    get display_name() { return this.name ?? `unknown (${this.id})` }

    constructor(public room: Room, public id: number) {
        room.users.set(this.id, this)

        this.el = document.createElement("div")
        this.el.classList.add("user")
        ROOM_CONTAINER.append(this.el)
        this.setup_view()
    }
    leave() {
        this.room.users.delete(this.id)
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
    }

    setup_view() {
        const info_el = document.createElement("div")
        info_el.classList.add("info")
        this.name_el.textContent = this.display_name
        this.name_el.classList.add("name")
        info_el.append(this.name_el, this.stats_el)
        this.el.append(info_el)
    }

    create_track_element(t: TrackHandle) {
        const is_video = t.kind == "video"
        const media_el = is_video ? document.createElement("video") : document.createElement("audio")
        const stream = new MediaStream([t.track])
        media_el.srcObject = stream
        media_el.classList.add("media")
        media_el.autoplay = true
        media_el.controls = true

        if (this.local) media_el.muted = true

        const el = document.createElement("div")
        if (t.local) {
            const end_button = document.createElement("button")
            end_button.textContent = "End"
            end_button.addEventListener("click", () => {
                t.end()
            })
            el.append(end_button)
        }
        el.append(media_el)
        this.el.append(el)
        t.addEventListener("ended", () => {
            media_el.srcObject = null
            el.remove()
        })
    }
}