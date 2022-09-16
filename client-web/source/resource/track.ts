import { ProvideInfo } from "../../../common/packets.d.ts";
import { ebutton } from "../helper.ts";
import { TrackHandle } from "../track_handle.ts";
import { User } from "../user/mod.ts";
import { Resource } from "./mod.ts";

export class TrackResource extends Resource {
    constructor(user: User, info: ProvideInfo, public track?: TrackHandle) {
        super(user, info)
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