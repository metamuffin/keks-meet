# keks-meet

A simple webrtc powered conference application

## Parameters

For configuration just add a set of the following options as query parameters to the URL (e.g. `/room/asdfg?username=bob`).

Booleans can be either `1`, `true`, `yes` or their opposites.

| Option name     | Type    | Default | Description                            |
| --------------- | ------- | ------- |
| `username`      | string  | "guest" | Sets the username                      |
| `rnnoise`       | boolean | true    | Enables noise suppression with rnnoise |
| `audio_enabled` | boolean | false   | Enables audio transmission by default  |
| `video_enabled` | boolean | false   | Enables video transmission by default  |
| `mic_gain`      | number  | 1       | Sets the microphone volume             |

## Licence

See `LICENCE` file.
