
export interface SCPacket {
    sender: string,
    data?: CSPacket,
    join?: boolean, // user just joined
    leave?: boolean, // user left
    stable?: boolean // user "joined" because you joined aka. user was already there
}
export interface CSPacket {
    receiver?: string
    ice_candiate?: RTCIceCandidateInit
    offer?: RTCSessionDescriptionInit
    answer?: RTCSessionDescriptionInit
}


