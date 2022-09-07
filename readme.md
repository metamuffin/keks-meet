# keks-meet

a web conferencing application

## Features

-   Rooms
-   Different stream types
    -   Camera
    -   Microphone
    -   Screen capture
-   Multiple streams

## Todo-List

-   Chat
-   Optionally enable video streams
-   Settings menu
-   Native client

## Parameters

For configuration add options in section of URL in a style that is common for query parameters (e.g. `/room/asdfg#username=bob`).
Note that the page wont automatically reload if the section changes.

Booleans can be either `1`, `true`, `yes` or their opposites.

| Option name      | Type    | Default | Description                              |
| ---------------- | ------- | ------- | ---------------------------------------- |
| `username`       | string  | "guest" | Sets the username                        |
| `rnnoise`        | boolean | true    | Enables noise suppression with rnnoise   |
| `mic_enabled`    | boolean | false   | Adds audio track on startup              |
| `camera_enabled` | boolean | false   | Adds camera track on startup             |
| `screen_enabled` | boolean | false   | Adds screen track on startup (wont work) |
| `mic_gain`       | number  | 1       | Sets the microphone volume               |

## Licence

See `LICENCE` file.
