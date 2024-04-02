/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2024 metamuffin <metamuffin.org>
*/
// there should be no deps to dom APIs in this file for the tablegen to work

import { LOCALES } from "../locale/mod.ts";

export function hex_id(len = 8): string {
    if (len > 8) return hex_id() + hex_id(len - 8)
    return Math.floor(Math.random() * 16 ** len).toString(16).padStart(len, "0")
}

// TODO this could be simpler
const string = "", bool = false, number = 0; // example types for ts
const optional = <T>(a: T): T | undefined => a

export const PREF_DECLS = {
    username: { type: string, default: "guest-" + hex_id(), allow_url: true },
    language: { type: string, possible_values: ["system", ...Object.keys(LOCALES)], default: "system", allow_url: true },
    
    /* MEDIA */
    rnnoise: { type: bool, default: true, allow_url: true },
    native_noise_suppression: { type: bool, default: false },
    microphone_gain: { type: number, default: 1 },
    video_fps: { type: number },
    video_resolution: { type: number },
    camera_facing_mode: { type: optional(string), possible_values: ["environment", "user"] },
    screencast_audio: { type: bool, default: false },
    auto_gain_control: { type: bool },
    echo_cancellation: { type: bool, allow_url: true },
    audio_activity_threshold: { type: number, optional: true, default: 0.003 },
    image_view_popup: { type: bool, default: true },
    microphone_enabled: { type: bool, default: false },
    screencast_enabled: { type: bool, default: false },
    camera_enabled: { type: bool, default: false },
    
    // TODO differenciate between mic, cam and screen
    optional_audio_default_enable: { type: bool, default: true },
    optional_video_default_enable: { type: bool, default: false },

    notify_chat: { type: bool, default: true, allow_url: true },
    notify_join: { type: bool, default: true, allow_url: true },
    notify_leave: { type: bool, default: true, allow_url: true },

    enable_onbeforeunload: { type: bool, default: true },
    webrtc_debug: { type: bool, default: false },
    show_log: { type: bool, default: false },

    warn_redirect: { type: bool, hidden: true, default: false, allow_url: true },
    room_watches: { type: string, default: "[]", hidden: true },
}
