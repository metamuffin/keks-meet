/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ProvideInfo } from "../../../common/packets.d.ts"
import { ediv } from "../helper.ts";
import { TrackHandle } from "../track_handle.ts";
import { LocalUser } from "../user/local.ts";
import { User } from "../user/mod.ts"
import { RemoteUser } from "../user/remote.ts"
import { TrackResource } from "./track.ts";

export type ChannelState = "enabled" | "await_enable" | "disabled" | "await_disable"
export abstract class Resource extends EventTarget {
    local: boolean
    el: HTMLElement = ediv({ class: ["channel"] })
    inner_el?: HTMLElement

    constructor(
        public user: User,
        public info: ProvideInfo,
    ) {
        super()
        this.local = this.user instanceof LocalUser
        const button = document.createElement("button")
        button.onclick = () => {
            this.state == "enabled" ? this.request_stop() : this.request()
        }
        this.addEventListener("statechange", () => {
            if (this.user instanceof LocalUser) button.textContent = "End", button.disabled = false
            else if (this.state == "enabled") button.textContent = "Disable", button.disabled = false
            else if (this.state == "disabled") button.textContent = `Enable ${this.info.kind}`, button.disabled = false
            else button.textContent = "Working…", button.disabled = true;
        })
        this.dispatchEvent(new CustomEvent("statechange"))
        this.el.append(button)
    }

    static create(user: User, info: ProvideInfo): Resource {
        if (info.kind == "audio" || info.kind == "video") return new TrackResource(user, info)
        else throw new Error("blub");
    }

    private _state: ChannelState = "disabled"
    get state() { return this._state }
    set state(value: ChannelState) {
        const old_value = this._state
        this._state = value
        if (value != old_value) this.dispatchEvent(new CustomEvent("statechange"))
    }

    private _track?: TrackHandle
    get track() { return this._track }
    set track(value: TrackHandle | undefined) {
        const handle_end = () => {
            this.track = undefined
            this.state = "disabled"
            this.inner_el?.remove()
            if (this.user instanceof LocalUser) this.destroy()
        }
        this._track?.removeEventListener("ended", handle_end)
        this._track = value
        if (value) this.el.append(this.inner_el = this.on_track(value))
        if (value) this.state = "enabled"
        else this.state = "disabled"
        this._track?.addEventListener("ended", handle_end)
    }

    abstract on_track(_track: TrackHandle): HTMLElement

    destroy() { this.dispatchEvent(new CustomEvent("destroy")) }

    request() {
        if (!(this.user instanceof RemoteUser)) return
        this.state = "await_enable"
        this.user.send_to({ request: { id: this.info.id } })
    }
    request_stop() {
        if (this.user instanceof RemoteUser) {
            this.state = "await_disable"
            this.user.send_to({ request_stop: { id: this.info.id } })
        } else if (this.user instanceof LocalUser) {
            this.destroy()
        }
    }
}
