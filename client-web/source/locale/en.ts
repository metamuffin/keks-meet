/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2024 metamuffin <metamuffin.org>
*/
import { LanguageStrings } from "./mod.ts";

export const PO_EN: LanguageStrings = {
    microphone: "Microphone",
    chatbox_placeholder: "Type a message",
    chatbox_label: "send message",
    join_message: author => [author, " joined."],
    leave_message: author => [author, " left."],
    summary_empty_message: "(empty message)",
    summery_image: "(image)",
    camera: "Camera",
    file: "File",
    leave: "Leave",
    screen: "Screen",
    image_alt: "Image (click to open)",
    warn_mem_download: "Downloading to memory because serviceworker is not available.",
    confirm_update: "Really update?",
    warn_short_secret: "Room name is very short. E2EE is insecure!",
    warn_secure_context: "This page is not a 'Secure Context'",
    warn_no_webrtc: "WebRTC not supported.",
    warn_no_crypto: "SubtleCrypto not availible",
    warn_no_sw: "Your browser does not support the Service Worker API, forced automatic updates are unavoidable.",
    warn_old_url: "You were redirected from the old URL format. The server knows the room secret now - E2EE is insecure!",
    confirm_quit: "You have local resources shared. Really quit?",
    controls: "Controls",
    license: "License",
    source_code: "Source code",
    stop_sharing: "Stop sharing",
    documentation: "Documentation",
    known_rooms: "Known Rooms",
    chat: "Chat",
    settings: "Settings",
    edit: "Edit",
    finish_edit: "Finish edit",
    add_current_room: "Add current room",
    add: "Add",
    move_down: "Move down",
    move_up: "Move up",
    unknown_user: "Unknown user",
    status_checking: "Checking...",
    status_connected: "Connected",
    status_failed: "Connection failed",
    status_disconnected: "Disconnected",
    status_no_conn: "Not connected",
    status_await_channel_open: "Waiting for data channel to open…",
    status_await_channel_close: "Waiting for data channel to close…",
    downloading: "Downloading…",
    download_again: "Download again",
    download: "Download",
    status_drain_buffer: amount => `Draining buffers… (buffer: ${amount})`,
    status_buffering: "Buffering…",
    status_closing: "Channel closing…",
    mute: "Mute",
    video_stream: "video stream",
    audio_stream: "audio stream",
    local: "Local",
    disable: "Disable",
    enable: thing => `Enable ${thing}`,
    status_await_stream: "Awaiting stream…",
    notification_perm_explain: "For keks-meet to send notifications, it needs you to grant permission: ",
    grant: "Grant",
    clear_prefs: "Want to clear all settings? Use this:",
    setting_descs: {
        language: "Interface Language",
        warn_redirect: "Internal option that is set by a server redirect.",
        image_view_popup: "Open image in popup instead of new tab",
        webrtc_debug: "Show additional information for WebRTC related stuff",
        screencast_audio: "Include audio when sharing your screen.",
        microphone_enabled: "Add one microphone track on startup",
        screencast_enabled: "Add one screencast track on startup",
        camera_enabled: "Add one camera track on startup",
        rnnoise: "Use RNNoise for noise suppression",
        native_noise_suppression: "Suggest the browser to do noise suppression",
        microphone_gain: "Amplify microphone volume",
        video_fps: "Preferred framerate (in 1/s) for screencast and camera",
        video_resolution: "Preferred horizontal resolution for screencast and camera",
        camera_facing_mode: "Prefer user-facing or env-facing camera",
        auto_gain_control: "Automatically adjust mic gain",
        echo_cancellation: "Cancel echo",
        audio_activity_threshold: "Audio activity threshold",
        optional_audio_default_enable: "Enable audio tracks by default",
        optional_video_default_enable: "Enable video tracks by default",
        notify_chat: "Send notifications for incoming chat messages",
        notify_join: "Send notifications when users join",
        notify_leave: "Send notifications when users leave",
        enable_onbeforeunload: "Prompt for confirmation when leaving the site while local resources are shared",
        room_watches: "Known rooms (as semicolon seperated list of name=secret pairs)",
        username: "Username",
        show_log: "Show extended log",
        preview_rate: "Preview rate",
        send_previews: "Send video previews",
        preview_resolution: "Preview resolution",
        preview_encoding_quality: "Preview encoding quality (0 - 100)",
    }
}
