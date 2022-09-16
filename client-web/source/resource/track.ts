import { ProvideInfo } from "../../../common/packets.d.ts";
import { ebutton } from "../helper.ts";
import { TrackHandle } from "../track_handle.ts";
import { LocalUser } from "../user/local.ts";
import { User } from "../user/mod.ts";
import { Resource } from "./mod.ts";

export class TrackResource extends Resource {
    private _track?: TrackHandle
    constructor(user: User, info: ProvideInfo, track?: TrackHandle) {
        super(user, info)
        this.track = track
    }

    get track() { return this._track }
    set track(value: TrackHandle | undefined) {
        const handle_end = () => {
            this.track = undefined
            if (this.user instanceof LocalUser) this.destroy()
        }
        this._track?.removeEventListener("ended", handle_end)
        this._track = value
        this._track?.addEventListener("ended", handle_end)
        this.update_el()
    }

    create_preview(): HTMLElement {
        return ebutton("Enable", { onclick: () => this.request() })
    }
    create_element() {
        if (!this.track) { return this.create_preview() }
        const el = document.createElement("div")

        const is_video = this.track.kind == "video"
        const media_el = is_video ? document.createElement("video") : document.createElement("audio")
        const stream = new MediaStream([this.track.track])
        media_el.srcObject = stream
        media_el.classList.add("media")
        media_el.autoplay = true
        media_el.controls = true
        if (this.track.local) media_el.muted = true
        el.append(media_el)

        if (this.track.local) {
            const end_button = document.createElement("button")
            end_button.textContent = "End"
            end_button.addEventListener("click", () => {
                this.track?.end()
            })
            el.append(end_button)
        }
        this.el.append(el)
        this.track.addEventListener("ended", () => {
            media_el.srcObject = null // TODO
            el.remove()
        })
        return el
    }
}