import { RemoteUser } from "./remote_user";
import { Room } from "./room";
import { User } from "./user";


export class LocalUser extends User {

    private audio_track?: MediaStreamTrack
    private video_track?: MediaStreamTrack

    constructor(room: Room, name: string) {
        super(room, name)
        this.create_controls()
        //@ts-ignore
        window.ea = () => this.enable_audio()
        //@ts-ignore
        window.da = () => this.disable_audio()
        //@ts-ignore
        window.ev = () => this.enable_video()
        //@ts-ignore
        window.dv = () => this.disable_video()
    }

    create_controls() {
        setTimeout(() => {
            this.enable_video()
        }, 3000)
    }

    async add_initial_to_remote(ru: RemoteUser) {
        if (this.audio_track) ru.peer.addTrack(this.audio_track)
        if (this.video_track) ru.peer.addTrack(this.video_track)
    }

    async enable_video() {
        if (this.video_track) return
        const user_media = await window.navigator.mediaDevices.getUserMedia({ video: true })
        console.log(user_media.getVideoTracks());
        const t = this.video_track = user_media.getVideoTracks()[0]
        this.room.remote_users.forEach(u => u.peer.addTrack(t))
    }
    async enable_audio() {
        if (this.audio_track) return
        const user_media = await window.navigator.mediaDevices.getUserMedia({ audio: true })
        const t = this.audio_track = user_media.getAudioTracks()[0]
        this.room.remote_users.forEach(u => u.peer.addTrack(t))
    }
    async disable_video() {
        if (!this.video_track) return
        this.room.remote_users.forEach(u => {
            u.peer.getSenders().forEach(s => {
                console.log(u, s, this.video_track);
                if (s.track == this.video_track) u.peer.removeTrack(s)
            })
        })
        this.video_track = undefined
    }
    async disable_audio() {
        if (!this.audio_track) return
        this.room.remote_users.forEach(u => {
            u.peer.getSenders().forEach(s => {
                if (s.track == this.audio_track) u.peer.removeTrack(s)
            })
        })
        this.audio_track = undefined
    }



}