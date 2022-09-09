// there should be no deps to dom APIs in this file for the tablegen to work

export function hex_id(len = 8): string {
    if (len > 8) return hex_id() + hex_id(len - 8)
    return Math.floor(Math.random() * 16 ** len).toString(16).padStart(len, "0")
}

// TODO this could be simpler
const string = "", bool = false, number = 0; // example types for ts
export const PREF_DECLS = {
    username: { type: string, default: "guest-" + hex_id(), description: "Username" },
    warn_redirect: { type: bool, default: false, description: "Interal option that is set by a server redirect." },

    /* MEDIA */
    microphone_enabled: { type: bool, default: false, description: "Add one microphone track on startup" },
    screencast_enabled: { type: bool, default: false, description: "Add one screencast track on startup" },
    camera_enabled: { type: bool, default: false, description: "Add one camera track on startup" },
    rnnoise: { type: bool, default: true, description: "Use RNNoise for noise suppression" },
    native_noise_suppression: { type: bool, default: false, description: "Suggest the browser to do noise suppression" },
    microphone_gain: { type: number, default: 1, description: "Amplify microphone volume" },
    video_fps: { type: number, description: "Preferred framerate (in 1/s) for screencast and camera" },
    video_resolution: { type: number, description: "Preferred width for screencast and camera" },
    camera_facing_mode: { type: string, possible_values: ["environment", "user"], description: "Prefer user-facing or env-facing camera" },
    auto_gain_control: { type: bool, description: "Automatically adjust mic gain" },
    echo_cancellation: { type: bool, description: "Cancel echo" },
}
