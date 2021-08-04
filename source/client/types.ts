
export interface SCPacket {
    sender: string,
    data: CSPacket,
    join?: boolean,
    leave?: boolean
}
export interface CSPacket {
    receiver?: string
    ice_candiate?: RTCIceCandidateInit
}


