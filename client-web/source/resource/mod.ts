import { ProvideInfo } from "../../../common/packets.d.ts"
import { ediv } from "../helper.ts"
import { log } from "../logger.ts"
import { User } from "../user/mod.ts"
import { RemoteUser } from "../user/remote.ts"
import { TrackResource } from "./track.ts"

export type ChannelState = "running" | "disconnected"

export abstract class Resource {
    el: HTMLElement = ediv({ class: ["channel"] })
    on_destroy = () => { }

    constructor(
        public user: User,
        public info: ProvideInfo,
    ) {
        setTimeout(() => this.update_el(), 0)
    }

    private _state: ChannelState = "disconnected"
    get state() { return this._state }
    set state(value: ChannelState) {
        if (value != this._state) this.update_el()
        this._state = value
    }

    destroy() { this.on_destroy() }

    abstract create_element(): HTMLElement
    abstract create_preview(): HTMLElement

    static create(user: User, info: ProvideInfo): Resource | undefined {
        if (info.kind == "audio" || info.kind == "video") return new TrackResource(user, info)
        if (info.kind == "file") throw new Error("");
        log({ scope: "media", warn: true }, "unknown resource kind")
    }

    request() {
        if (!(this.user instanceof RemoteUser)) return
        this.user.send_to({ request: { id: this.info.id } })
    }
    request_stop() {
        if (!(this.user instanceof RemoteUser)) return
        this.user.send_to({ request: { id: this.info.id } })
    }

    update_el() {
        this.el.innerHTML = ""
        this.el.append(this.create_element())
    }
}
