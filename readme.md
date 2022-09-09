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

## Licence

GNU Affero General Public License version 3 only; See [COPYING](./COPYING).

## Security

keks-meet _tries_ to be secure. However I am not a security expert. The current system works as follows:

-   The room name is set in the section of the URL (-> not sent to the server)
-   The server receives a salted hash of the room name to group client of a room
-   We use PBKDF2 (constant salt; 250000 iterations) to derive a 256-bit AES-GCM key
-   All relayed message contents are encrypted with this key.
    -   Message recipient is visible to the server
    -   The server assigns user ids

## Usage

For trying it out, a hosted version is available on [my server](https://meet.metamuffin.org/).
For self-hosting, this script should do:

```
git clone https://codeberg.org/metamuffin/keks-meet.git
cd keks-meet
make -C client-web
cd server
cargo run --release
```

## Parameters

Configuration parameters are added like query params but **after** the section. (e.g `/room#mymeeting?username=alice`)
The page will not automatically reload if the section changes.
Booleans can be either `1`, `true`, `yes` or their opposites.

| Option name                | Default   | Description                                                    |
| -------------------------- | --------- | -------------------------------------------------------------- |
| `rnnoise`                  | `true`    | Use RNNoise for noise suppression                              |
| `native_noise_suppression` | `false`   | Suggest the browser to do noise suppression                    |
| `username`                 | `guest-…` | "Username                                                      |
| `microphone_gain`          | `1`       | Amplify microphone volume                                      |
| `microphone_enabled`       | `false`   | Add one microphone track on startup                            |
| `camera_enabled`           | `false`   | Add one camera track on startup                                |
| `screencast_enabled`       | `false`   | Add one screencast track on startup                            |
| `camera_facing_mode`       | undefined | Prefer user-facing or env-facing camera (`environment`/`user`) |

## Todo-List

-   Chat
-   Optionally enable video streams
-   Settings menu
-   Native client
-   Prevent server from changing message sender
-   Have a security professional look at the code
-   Test some options like `camera_facing_mode`
-   Signing key for each user
-   Built-in storage for known keys
-   Prevent a client from sendin differing user names to other clients
-   Fix chat CSS (impossible™)

## Protocol

The protocol packets are defined in [packets.d.ts](./common/packets.d.ts). Here is an (simplified) example of how the protocol is used.

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
