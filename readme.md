# keks-meet

a simple secure web conferencing application

## Features

- Rooms
- Different stream types
  - Camera
  - Microphone
  - Screen capture
- Multiple streams
- Noise suppression (rnnoise)
- End-to-end-encryption
- Peer-to-peer data transmission
- Chat (text and images)

## Licence

Licensed under the terms of the GNU Affero General Public License version 3
only. See [COPYING](./COPYING).

## Usage

For trying it out, a hosted version is available on
[my server](https://meet.metamuffin.org/). For self-hosting, this should help:

```sh
pacman -S --needed deno rustup make coreutils; rustup install nightly
git clone https://codeberg.org/metamuffin/keks-meet.git
cd keks-meet
make run
```

When changing code, use `make watch` to re-build things automatically as needed.
(run `cargo install systemfd cargo-watch` if needed)

If you use this project or have any suggestions, please
[contact me](https://metamuffin.org/contact)

## _Rift_

_Rift_ is similar to the
[magic wormhole](https://github.com/magic-wormhole/magic-wormhole), except that
it's peer-to-peer. It reuses the keks-meet signaling server to establish a
WebRTC data channel.

```sh
pacman -S --needed rustup; rustup install nightly
cargo +nightly install --path client-native-rift
rift --help
```

```sh
rift --secret hunter2 send /path/to/file &
rift --secret hunter2 receive /path/to/output
```

## Security

keks-meet _tries_ to be secure. However I am not a security expert. The current
system works as follows:

- The room name is set in the section of the URL which is not sent to the
  server.
- The server receives a salted SHA-256 hash of the room name to group clients of
  a room.
- The client uses PBKDF2 (constant salt; 250000 iterations) to derive a 256-bit
  AES-GCM key from the room name.
- All relayed message contents are encrypted with this key.
  - Message recipient is visible to the server
  - The server assigns user ids

## Keybinds

| Keybind   | Action                                                  |
| --------- | ------------------------------------------------------- |
| `RET`     | Toggle chat                                             |
| `SPC M`   | Add microphone track                                    |
| `SPC R`   | Add microphone track (but with your left hand)          |
| `SPC C`   | Add camera track                                        |
| `SPC S`   | Add screencast track                                    |
| `SPC C-c` | End all tracks                                          |
| `C-v`\*   | Paste image in chat (does not require chat to be shown) |

## Todo-List

- Make the optional streams UI prettier
- Maybe group tracks in streams to make sure everything is in sync
- How do we implement global hotkeys?
- Dont use websocket to send images to not block anything else
- File transfers via data channel (rift)
- Native client
- Have a security professional look at the code
- Test some options like `camera_facing_mode`
- Signing key for each user
  - Built-in storage for known keys
- Relay RTC when there are a lot of clients
- Prevent join notification bypass by not identifying
- Tray icon for native
- Pin js by bookmarking data:text/html loader page
- add "contributing" stuff to readme
- download files in a streaming manner.
  - workaround using service worker
- service worker to implement manual updates
- open chat links in a new tab
- increase message size again when https://github.com/webrtc-rs/webrtc/pull/304
  is resolved

## Parameters

Some configuration parameters can be added like query params but **after** the
section. (e.g `/room#mymeeting?username=alice`) The page will not automatically
reload if the section changes. Booleans can be either `1`, `true`, `yes` or
their opposites. I convenience function for changing params is also exported:
`window.change_pref(key, value)`

| Option name                     | Type    | Default     | Description                                                          |
| ------------------------------- | ------- | ----------- | -------------------------------------------------------------------- |
| `username`                      | string  | `"guest-…"` | Username                                                             |
| `warn_redirect`                 | boolean | `false`     | Internal option that is set by a server redirect.                    |
| `image_view_popup`              | boolean | `true`      | Open image in popup instead of new tab                               |
| `webrtc_debug`                  | boolean | `false`     | Show additional information for WebRTC related stuff                 |
| `microphone_enabled`            | boolean | `false`     | Add one microphone track on startup                                  |
| `screencast_enabled`            | boolean | `false`     | Add one screencast track on startup                                  |
| `camera_enabled`                | boolean | `false`     | Add one camera track on startup                                      |
| `rnnoise`                       | boolean | `true`      | Use RNNoise for noise suppression                                    |
| `native_noise_suppression`      | boolean | `false`     | Suggest the browser to do noise suppression                          |
| `microphone_gain`               | number  | `1`         | Amplify microphone volume                                            |
| `video_fps`                     | number  | -           | Preferred framerate (in 1/s) for screencast and camera               |
| `video_resolution`              | number  | -           | Preferred width for screencast and camera                            |
| `camera_facing_mode`            | string  | -           | Prefer user-facing or env-facing camera (`"environment"` / `"user"`) |
| `auto_gain_control`             | boolean | -           | Automatically adjust mic gain                                        |
| `echo_cancellation`             | boolean | -           | Cancel echo                                                          |
| `optional_audio_default_enable` | boolean | `true`      | Enable audio tracks by default                                       |
| `optional_video_default_enable` | boolean | `false`     | Enable video tracks by default                                       |
| `notify_chat`                   | boolean | `true`      | Send notifications for incoming chat messages                        |
| `notify_join`                   | boolean | `true`      | Send notifications when users join                                   |
| `notify_leave`                  | boolean | `true`      | Send notifications when users leave                                  |

## Protocol

The protocol packets are defined in [packets.d.ts](./common/packets.d.ts). Here
are some simplified examples of how the protocol is used.

```
S->C    { init: { your_id: 5, version: "..." } }
----    # Your join packet will be the first one.
S->C    { client_join: { id: 5 } }
S->C    { client_join: { id: 3 } }
----    # The server doesnt know people's names so they identify themselves.
S->C    { message: { sender: 3, message: <Encrypted { identify: { username: "Alice" } }> } }
----    # You should do that too.
C->S    { relay: { message: <Encrypted { identify: { username: "Bob" } }> } }
----    # Publish your ICE candidates.
C->S    { relay: { message: <Encrypted { ice_candiate: <RTCIceCandidateInit> }> } }
----    # If you create a resource, tell others about it:
C->S    { relay: { message: <Encrypted { provide: { id: "asd123", label: "Camera", kind: "track", track_kind: "video" } }> } }
----    # If somebody is interested in this resource, they will request you to transmit.
S->C    { message: { sender: 3, message: <Encrypted { request: { id: "asd123" } }> } }
----    # Whenever you change your tracks/data channels:
----    # Send an offer to everybody
C->S    { relay: <Encrypted { recipient: 3, offer: <RTCSessionDescriptionInit> }> }
----    # Await answer:
S->C    { message: { sender: 3, message: <Encrypted { offer: <RTCSessionDescriptionInit> }> } }
----    # In case the server uses a reverse-proxy that disconnects inactive connections: Ping every 30s
C->S    { ping: null }
```

If you decide to implement this protocol, please make sure it is compatible,
especially ensure that channels/tracks are only added on request and to not
reuse existing identifiers for new protocol packets.
