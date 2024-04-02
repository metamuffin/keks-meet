import { PO_DE_DE } from "./de.ts";
import { PO_EN_US } from "./en.ts";
import { PREF_DECLS } from "../preferences/decl.ts";

export let PO: LanguageStrings;

export function init_locale(lang: string) {
    if (lang == "system") lang = navigator.language
    if (!LOCALES[lang]) lang = "en-US"
    PO = LOCALES[lang]
}

export const LOCALES: { [key: string]: LanguageStrings } = {
    "en": PO_EN_US,
    "en-US": PO_EN_US,
    "de": PO_DE_DE,
    "de-DE": PO_DE_DE,
}

export interface LanguageStrings {
    microphone: string,
    camera: string,
    screen: string,
    file: string,
    warn_short_secret: string,
    warn_no_webrtc: string,
    warn_secure_context: string,
    warn_no_crypto: string,
    warn_no_sw: string,
    warn_old_url: string,
    warn_mem_download: string,
    chatbox_placeholder: string,
    chatbox_label: string,
    confirm_quit: string,
    controls: string,
    license: string,
    source_code: string,
    documentation: string,
    chat: string,
    settings: string,
    known_rooms: string,
    leave: string,
    confirm_update: string,
    image_alt: string,
    join_message(author: HTMLElement | string): (HTMLElement | string)[],
    leave_message(author: HTMLElement | string): (HTMLElement | string)[],
    summary_empty_message: string,
    summery_image: string,
    edit: string,
    finish_edit: string,
    add_current_room: string,
    add: string,
    move_up: string,
    move_down: string,
    unknown_user: string,
    status_connected: string,
    status_no_conn: string,
    status_checking: string,
    status_disconnected: string,
    status_failed: string,
    downloading: string,
    download: string,
    download_again: string,
    stop_sharing: string,
    status_await_channel_open: string,
    status_await_channel_close: string,
    status_drain_buffer(amount: number): string,
    status_buffering: string,
    status_closing: string,
    mute: string,
    video_stream: string,
    audio_stream: string,
    enable: string,
    disable: string,
    notification_perm_explain: string,
    grant: string,
    status_await_track: string,
    clear_prefs: string,
    setting_descs: { [key in keyof typeof PREF_DECLS]: string },
}
