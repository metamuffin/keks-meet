/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ProvideInfo } from "../../../common/packets.d.ts"
import { TrackHandle } from "../track_handle.ts";
import { RemoteUser } from "../user/remote.ts"
import { resource_file } from "./file.ts";
import { resource_track } from "./track.ts";

// export abstract class Resource extends EventTarget {
//     abstract transport_method: TransportMethod
//     local: boolean
//     el: HTMLElement = ediv({ class: ["channel"] })
//     inner_el?: HTMLElement

//     constructor(
//         public user: User,
//         public info: ProvideInfo,
//     ) {
//         super()
//         this.local = this.user instanceof LocalUser
//         const button = document.createElement("button")
//         button.onclick = () => {
//             this.state == "enabled" ? this.request_stop() : this.request()
//         }
//         this.addEventListener("statechange", () => {
//             if (this.local) button.textContent = "End", button.disabled = false
//             else if (this.state == "enabled") button.textContent = "Disable", button.disabled = false
//             else if (this.state == "disabled") button.textContent = `Enable ${this.info.kind}`, button.disabled = false
//             else button.textContent = "Working…", button.disabled = true;
//         })
//         this.dispatchEvent(new CustomEvent("statechange"))
//         this.el.append(button)
//     }

//     static create(user: User, info: ProvideInfo): Resource {
//     }

//     private _state: ChannelState = "disabled"
//     get state() { return this._state }
//     set state(value: ChannelState) {
//         const old_value = this._state
//         this._state = value
//         if (value != old_value) this.dispatchEvent(new CustomEvent("statechange"))
//     }

//     private _channel?: TrackHandle | RTCDataChannel
//     get channel() { return this._channel }
//     set channel(value: TrackHandle | RTCDataChannel | undefined) {
//         const handle_end = () => {
//             this.channel = undefined
//             this.state = "disabled"
//             this.inner_el?.remove()
//             if (this.user instanceof LocalUser) this.destroy()
//         }
//         this._channel?.removeEventListener("ended", handle_end)
//         this._channel = value
//         if (value) this.el.append(this.inner_el = this.on_channel(value))
//         if (value) this.state = "enabled"
//         else this.state = "disabled"
//         this._channel?.addEventListener("ended", handle_end)
//     }

//     abstract on_channel(channel: TrackHandle | RTCDataChannel): HTMLElement
//     abstract on_request(): void;

//     destroy() { this.dispatchEvent(new CustomEvent("destroy")) }

//     request() {
//         if (!(this.user instanceof RemoteUser)) return
//         this.state = "await_enable"
//         this.user.send_to({ request: { id: this.info.id } })
//     }
//     request_stop() {
//         if (this.user instanceof RemoteUser) {
//             this.state = "await_disable"
//             this.user.send_to({ request_stop: { id: this.info.id } })
//         } else if (this.user instanceof LocalUser) {
//             this.destroy()
//         }
//     }
// }

export type TransportMethod = "data-channel" | "track"
export type RemoteResourceState = "connected" | "disconnected" | "await_connect" | "await_disconnect"
export interface ResourceHandlerDecl {
    kind: string
    new_remote(info: ProvideInfo, user: RemoteUser, enable: () => void): RemoteResource
}
export interface RemoteResource {
    el: HTMLElement
    info: ProvideInfo,
    on_statechange(state: RemoteResourceState): void
    on_enable(t: TrackHandle | RTCDataChannel, disable: () => void): void
}
export interface LocalResource {
    el: HTMLElement
    info: ProvideInfo,
    destroy(): void
    on_request(user: RemoteUser, create_channel: () => RTCDataChannel): TrackHandle | RTCDataChannel
}

const RESOURCE_HANDLERS: ResourceHandlerDecl[] = [resource_file, resource_track]

export function new_remote_resource(user: RemoteUser, info: ProvideInfo): RemoteResource | undefined {
    const h = RESOURCE_HANDLERS.find(h => h.kind == info.kind)
    if (!h) return undefined
    const res = h.new_remote(info, user, () => {
        user.request_resource(res)
    })
    return res
}