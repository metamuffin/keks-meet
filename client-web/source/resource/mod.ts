/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2024 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { ProvideInfo } from "../../../common/packets.d.ts"
import { RemoteUser } from "../user/remote.ts"
import { resource_file } from "./file.ts";
import { resource_track } from "./track.ts";

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
    on_enable(t: MediaStream | RTCDataChannel, disable: () => void): void,

    stream?: MediaStream
}
export interface LocalResource {
    el: HTMLElement
    info: ProvideInfo,
    destroy(): void
    on_request(user: RemoteUser, create_channel: () => RTCDataChannel): MediaStream | RTCDataChannel,
    set_destroy(cb: () => void): void
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