
// copy pasted from dom.lib.d.ts because it can not be referenced in the server.
type F_RTCSdpType = "answer" | "offer" | "pranswer" | "rollback";
interface F_RTCSessionDescriptionInit { sdp?: string; type: F_RTCSdpType; }
interface F_RTCIceCandidateInit { candidate?: string; sdpMLineIndex?: number | null; sdpMid?: string | null; usernameFragment?: string | null; }

export interface ClientboundPacket {
    init?: { your_id: number, version: string },
    client_join?: { id: number },
    client_leave?: { id: number },
    message?: { sender: number, message: string },
}

export interface ServerboundPacket {
    ping?: null,
    relay?: { recipient?: number, message: string },
}

export interface RelayMessage {
    identify?: { name: string }
    offer?: F_RTCSessionDescriptionInit,
    answer?: F_RTCSessionDescriptionInit,
    ice_candidate?: F_RTCIceCandidateInit,
}
