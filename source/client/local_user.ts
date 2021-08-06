import { RemoteUser } from "./remote_user";
import { Room } from "./room";
import { User } from "./user";


export class LocalUser extends User {
    constructor(room: Room, name: string) {
        super(room, name)
        this.get_streams()
    }

    async get_streams() {
        const user_media = await window.navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        await new Promise<void>(r => setTimeout(() => r(), 3000))
        for (const t of user_media.getTracks()) {
            this.add_track(t)
        }
    }

    add_tracks_to_remote(u: RemoteUser) {
        this.stream.forEach(t => {
            u.peer.addTrack(t, new MediaStream())
        })
    }

    add_track(t: MediaStreamTrack) {
        this.update_view()
        this.stream.push(t)
        this.room.remote_users.forEach(u => {
            u.peer.addTrack(t)
        })
    }

}