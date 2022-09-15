# keks-meet

a web conferencing application

## Features

-   Rooms
-   Different stream types
    -   Camera
    -   Microphone
    -   Screen capture
-   Multiple streams
-   Noise suppression (rnnoise)
-   End-to-end-encryption
-   Chat (text and images)

## Licence

Licensed under the terms of the GNU Affero General Public License version 3 only. See [COPYING](./COPYING).

## Security

keks-meet _tries_ to be secure. However I am not a security expert. The current system works as follows:

-   The room name is set in the section of the URL which is not sent to the server.
-   The server receives a salted SHA-256 hash of the room name to group clients of a room.
-   The client uses PBKDF2 (constant salt; 250000 iterations) to derive a 256-bit AES-GCM key from the room name.
-   All relayed message contents are encrypted with this key.
    -   Message recipient is visible to the server
    -   The server assigns user ids

## Usage

For trying it out, a hosted version is available on [my server](https://meet.metamuffin.org/).
For self-hosting, this should help:

```sh
pacman -S --needed deno rustup make coreutils; rustup install nightly
git clone https://codeberg.org/metamuffin/keks-meet.git
cd keks-meet
make run
```

When changing code, use `make watch` to re-build things automatically as needed.

If you use this project or have any suggestions, please [contact me](https://metamuffin.org/contact)

## Rift

_Rift_ is similar to the [magic wormhole](https://github.com/magic-wormhole/magic-wormhole), except that is peer-to-peer. It reuses the keks-meet signaling server to establish a WebRTC data channel.

```sh
pacman -S --needed rustup; rustup install nightly
cargo +nightly install --path client-native-rift
rift --help
```

```sh
rift --secret hunter2 send /path/to/file &
rift --secret hunter2 receive /path/to/output
```

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

## Parameters

Some configuration parameters can be added like query params but **after** the section. (e.g `/room#mymeeting?username=alice`)
The page will not automatically reload if the section changes.
Booleans can be either `1`, `true`, `yes` or their opposites. I convenience function for changing params is also exported: `window.change_pref(key, value)`

| Option name                | Type    | Default     | Description                                                          |
| -------------------------- | ------- | ----------- | -------------------------------------------------------------------- |
| `username`                 | string  | `"guest-…"` | Username                                                             |
| `warn_redirect`            | boolean | `false`     | Internal option that is set by a server redirect.                    |
| `image_view_popup`         | boolean | `true`      | Open image in popup instead of new tab                               |
| `microphone_enabled`       | boolean | `false`     | Add one microphone track on startup                                  |
| `screencast_enabled`       | boolean | `false`     | Add one screencast track on startup                                  |
| `camera_enabled`           | boolean | `false`     | Add one camera track on startup                                      |
| `rnnoise`                  | boolean | `true`      | Use RNNoise for noise suppression                                    |
| `native_noise_suppression` | boolean | `false`     | Suggest the browser to do noise suppression                          |
| `microphone_gain`          | number  | `1`         | Amplify microphone volume                                            |
| `video_fps`                | number  | -           | Preferred framerate (in 1/s) for screencast and camera               |
| `video_resolution`         | number  | -           | Preferred width for screencast and camera                            |
| `camera_facing_mode`       | string  | -           | Prefer user-facing or env-facing camera (`"environment"` / `"user"`) |
| `auto_gain_control`        | boolean | -           | Automatically adjust mic gain                                        |
| `echo_cancellation`        | boolean | -           | Cancel echo                                                          |
| `notify_chat`              | boolean | `true`      | Send notifications for incoming chat messages                        |
| `notify_join`              | boolean | `true`      | Send notifications when users join                                   |
| `notify_leave`             | boolean | `true`      | Send notifications when users leave                                  |

## Todo-List

-   Optionally enable video streams
-   Native client
-   Prevent server from changing message sender
-   Have a security professional look at the code
-   Test some options like `camera_facing_mode`
-   Signing key for each user
    -   Built-in storage for known keys
-   Relay RTC when there are a lot of clients
-   Save permissions to locale storage
-   Prevent join notification bypass by not identifying
-   Dont use websocket to send images to not block anything else
-   How do we implement global hotkeys?
-   Tray icon for native
-   Pin js by bookmarking data:text/html loader page

## Protocol

The protocol packets are defined in [packets.d.ts](./common/packets.d.ts). Here is an (simplified) example of how the protocol is used.

**THIS IS OBSOLETE! The new protocol is quite similar but uses encryption**

```
S->C    { init: { your_id: 5, version: "..." } }
----    # Your join packet will be the first one.
S->C    { client_join: { id: 5, name: "bob" } }
S->C    { client_join: { id: 3, name: "alice" } }
----    # Now publish your ICE candidates
C->S    { relay: { message: { ice_candiate: <RTCIceCandidateInit> } } }
----    # Whenever you change your streams change:
----    # Send an offer to everybody
C->S    { relay: { recipient: 3, offer: <RTCSessionDescriptionInit> } }
----    # Alice answers
S->C    { message: { sender: 3, message: { offer: <RTCSessionDescriptionInit> } } }
----    # In case the server uses a reverse-proxy that disconnects inactive connections: Ping every 30s
C->S    { ping: null }
```
