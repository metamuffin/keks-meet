# keks-meet

a online conference application

## Parameters

For configuration just add a set of the following options as query parameters to the URL (e.g. `/room/asdfg#username=bob`).
Note that the page wont automatically reload if the 

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
