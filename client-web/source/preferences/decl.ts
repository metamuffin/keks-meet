/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
// there should be no deps to dom APIs in this file for the tablegen to work

export function hex_id(len = 8): string {
    if (len > 8) return hex_id() + hex_id(len - 8)
    return Math.floor(Math.random() * 16 ** len).toString(16).padStart(len, "0")
}

// TODO this could be simpler
const string = "", bool = false, number = 0; // example types for ts
const optional = <T>(a: T): T | undefined => a

export const PREF_DECLS = {
    username: { type: string, default: "guest-" + hex_id(), description: "Username", allow_url: true },
    warn_redirect: { type: bool, hidden: true, default: false, description: "Internal option that is set by a server redirect.", allow_url: true },
    image_view_popup: { type: bool, default: true, description: "Open image in popup instead of new tab" },
    webrtc_debug: { type: bool, default: false, description: "Show additional information for WebRTC related stuff" },

    /* MEDIA */
    microphone_enabled: { type: bool, default: false, description: "Add one microphone track on startup" },
    screencast_enabled: { type: bool, default: false, description: "Add one screencast track on startup" },
    camera_enabled: { type: bool, default: false, description: "Add one camera track on startup" },
    rnnoise: { type: bool, default: true, description: "Use RNNoise for noise suppression" },
    native_noise_suppression: { type: bool, default: false, description: "Suggest the browser to do noise suppression" },
    microphone_gain: { type: number, default: 1, description: "Amplify microphone volume" },
    video_fps: { type: number, description: "Preferred framerate (in 1/s) for screencast and camera" },
    video_resolution: { type: number, description: "Preferred width for screencast and camera" },
    camera_facing_mode: { type: optional(string), possible_values: ["environment", "user"], description: "Prefer user-facing or env-facing camera" },
    auto_gain_control: { type: bool, description: "Automatically adjust mic gain" },
    echo_cancellation: { type: bool, description: "Cancel echo" },
    // TODO differenciate between mic, cam and screen
    optional_audio_default_enable: { type: bool, default: true, description: "Enable audio tracks by default" },
    optional_video_default_enable: { type: bool, default: false, description: "Enable video tracks by default" },

    notify_chat: { type: bool, default: true, description: "Send notifications for incoming chat messages" },
    notify_join: { type: bool, default: true, description: "Send notifications when users join" },
    notify_leave: { type: bool, default: true, description: "Send notifications when users leave" },

    enable_onbeforeunload: { type: bool, default: true, description: "Prompt for confirmation when leaving the site while local resources are active" }
}
