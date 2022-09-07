
// copy pasted from dom.lib.d.ts because it can not be referenced in the server.
type F_RTCSdpType = "answer" | "offer" | "pranswer" | "rollback";
interface F_RTCSessionDescriptionInit { sdp?: string; type: F_RTCSdpType; }
interface F_RTCIceCandidateInit { candidate?: string; sdpMLineIndex?: number | null; sdpMid?: string | null; usernameFragment?: string | null; }

export interface PacketC {
    sender: string,
    data?: PacketS,
    join?: boolean, // user just joined
    leave?: boolean, // user left
    stable?: boolean // user "joined" because you joined aka. user was already there
}
export interface PacketS {
    receiver?: string
    ice_candidate?: F_RTCIceCandidateInit
    offer?: F_RTCSessionDescriptionInit
    answer?: F_RTCSessionDescriptionInit
}

