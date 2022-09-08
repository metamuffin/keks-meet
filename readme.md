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

## Todo-List

-   Chat
-   Optionally enable video streams
-   Settings menu
-   Native client

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

For configuration options must be added either

1. in options in the query parameters (e.g. `/myroom?username=alice`)
2. in options in section of URL (e.g. `/myroom#rnnoise=no`).

The page will not automatically reload if the section changes.
Booleans can be either `1`, `true`, `yes` or their opposites.

| Option name       | Type    | Default | Description                              |
| ----------------- | ------- | ------- | ---------------------------------------- |
| `?username`       | string  | "guest" | Sets the username                        |
| `#rnnoise`        | boolean | true    | Enables noise suppression with rnnoise   |
| `#mic_enabled`    | boolean | false   | Adds audio track on startup              |
| `#camera_enabled` | boolean | false   | Adds camera track on startup             |
| `#screen_enabled` | boolean | false   | Adds screen track on startup (wont work) |
| `#mic_gain`       | number  | 1       | Amplifies the microphone volume          |

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

## Licence

See `LICENCE` file.
