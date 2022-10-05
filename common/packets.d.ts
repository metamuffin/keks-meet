/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/

// copy pasted from dom.lib.d.ts because it can not be referenced in the server.
type Sdp = string
interface F_RTCIceCandidateInit { candidate?: string; sdpMLineIndex?: number | null; sdpMid?: string | null; usernameFragment?: string | null; }

export interface /* enum */ ClientboundPacket {
    init?: { your_id: number, version: string },
    client_join?: { id: number },
    client_leave?: { id: number },
    message?: { sender: number, message: string /* encrypted RelayMessageWrapper */ },
}

export interface /* enum */ ServerboundPacket {
    ping?: null,
    relay?: { recipient?: number, message: string /* encrypted RelayMessageWrapper */ },
}

export interface RelayMessageWrapper {
    sender: number, // redundant, but ensures the server didnt cheat
    inner: RelayMessage
}

export interface /* enum */ RelayMessage {
    chat?: ChatMessage,
    identify?: { username: string }

    provide?: ProvideInfo
    request?: { id: string }
    provide_stop?: { id: string }
    request_stop?: { id: string }

    offer?: Sdp,
    answer?: Sdp,
    ice_candidate?: F_RTCIceCandidateInit,
}
export interface ChatMessage { text?: string, image?: string }
export type ResourceKind = "track" | "file"
export type TrackKind = "audio" | "video"
export interface ProvideInfo {
    id: string, // for datachannels this is `label`, for tracks this will be the `id` of the only associated stream.
    kind: ResourceKind
    track_kind?: TrackKind
    label?: string
    size?: number
}
