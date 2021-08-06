# keks-meet

A simple webrtc powered conference application

## Parameters

For configuration just add a set of the following options as query parameters to the URL (e.g. `/room/asdfg?username=bob`).

Booleans can be either `1`, `true`, `yes` or their opposites.

| Option name     | Type    | Description                            |
| --------------- | ------- | -------------------------------------- |
| `username`      | string  | Sets the username                      |
| `rnnoise`       | boolean | Enables noise suppression with rnnoise |
| `audio_enabled` | boolean | Enables audio transmission by default  |
| `video_enabled` | boolean | Enables video transmission by default  |

## Licence

See `LICENCE` file.
