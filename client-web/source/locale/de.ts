/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2024 metamuffin <metamuffin.org>
*/
import { LanguageStrings } from "./mod.ts";

export const PO_DE_DE: LanguageStrings = {
    microphone: "Mikrofon",
    chatbox_placeholder: "Schreibe eine nachricht",
    chatbox_label: "Sende nachricht",
    join_message: author => [author, " kommt."],
    leave_message: author => [author, " geht."],
    summary_empty_message: "(leere nachricht)",
    summery_image: "(bild)",
    camera: "Kamera",
    file: "Datei",
    leave: "Verlassen",
    screen: "Bildschirm",
    image_alt: "Bild (Klicken zum Öffnen)",
    warn_mem_download: "Download zu Arbeitsspeicher, weil Serviceworker nicht verfügbar sind.",
    confirm_update: "Really update?",
    warn_short_secret: "Raumgeheimniss sehr kurz; Verschlüsslung ist nicht sicher.",
    warn_secure_context: "Die Seite ist kein 'Secure Context'",
    warn_no_webrtc: "WebRTC wird nicht unterstützt.",
    warn_no_crypto: "SubtleCrypto ist nicht verfügbar",
    warn_no_sw: "Dein Browser unterstützt die Service Worker API nicht, automatische Updates sind nicht verhinderbar.",
    warn_old_url: "Du wurdest vom alten URL-Format weitergeleitet. Der Server kennt jetzt das Raumgeheimniss; Verschlüsslung ist nicht sicher.",
    confirm_quit: "Du teilst Dinge. Wirklich verlassen?",
    controls: "Steuerung",
    license: "Lizenz",
    source_code: "Quellcode",
    stop_sharing: "Teilen beenden",
    documentation: "Dokumentation",
    known_rooms: "Bekannte Räume",
    chat: "Chat",
    settings: "Einstellungen",
    edit: "Bearbeiten",
    finish_edit: "Fertig",
    local: "Lokal",
    add_current_room: "Aktuellen Raum hinzufügen",
    add: "Hinzufügen",
    move_down: "Runter",
    move_up: "Hoch",
    unknown_user: "Unbekannter Benutzer",
    status_checking: "Prüfen...",
    status_connected: "Verbunden",
    status_failed: "Verbindung fehlgeschlagen",
    status_disconnected: "Verbindung getrennt",
    status_no_conn: "Nicht verbunden",
    status_await_channel_open: "Warten auf Übertragungskanal…",
    status_await_channel_close: "Warten auf das Schließen des Übertragungskanals…",
    downloading: "Lädt herunten…",
    download_again: "Nochmal Heruntenladen",
    download: "Herunterladen",
    status_drain_buffer: amount => `Puffer leeren… (buffer: ${amount})`,
    status_buffering: "Puffert…",
    status_closing: "Kanal schließt…",
    mute: "Stumm",
    video_stream: "Videoübertragung",
    audio_stream: "Audioübertragung",
    disable: "Deaktivieren",
    enable: "Aktivieren",
    status_await_stream: "Übertragung startet…",
    notification_perm_explain: "Um Benarchichtigungen zu erhalten, musst du die keks-meet die Berechtigung dafür geben. ",
    grant: "Berechtigen",
    clear_prefs: "Du willst alle Einstellungen löschen? Nimm den hier: ",
    setting_descs: {
        language: "Sprache",
        warn_redirect: "Interne Option, die der Server bei einer Weiterleitung setzt.",
        image_view_popup: "Öffne Bilder in einem neuen Tab",
        webrtc_debug: "Zeige erweiterte Informationen zu WebRTC zeugs",
        screencast_audio: "Anwendungsaudio bei Bildschirmübertragung aufzeichnen",
        microphone_enabled: "Füge eine Mikrofonspur beim start hinzu.",
        screencast_enabled: "Füge eine Bildschirmspur beim start hinzu.",
        camera_enabled: "Füge eine Kameraspur beim start hinzu.",
        rnnoise: "Benutze RNNoise für Rauschunterdrückung",
        native_noise_suppression: "Schlage dem Browser vor, selbst Rauschen zu Unterdrücken",
        microphone_gain: "Mikrofonlautstärke",
        video_fps: "Preferierte Bildrate (in 1/s) für Bildschirm und Kamera",
        video_resolution: "Preferierte Breite für Bildschirm und Kamera",
        camera_facing_mode: "Preferierte Kameraausrichtung",
        auto_gain_control: "Automatische Mikrofonlautstärkeanpassung",
        echo_cancellation: "Echounterrückung",
        audio_activity_threshold: "Audioaktivitätsschwellwert",
        optional_audio_default_enable: "Audiospuren automatisch aktivieren",
        optional_video_default_enable: "Videospuren automatisch aktivieren",
        notify_chat: "Sende Benarchichtigungen für eingehende Chatnachrichten",
        notify_join: "Sende Benarchichtigungen wenn Benutzer beitreten",
        notify_leave: "Sende Benarchichtigungen wenn Benutzer gehen",
        enable_onbeforeunload: "Frage nach Bestätigung beim verlassen der Seite wenn Spuren geteilt sind.",
        room_watches: "Bekannte Räume (Als semikolongetrennte Liste von name=geheimnis Paaren)",
        username: "Benutzername",
        show_log: "Zeige ausführlichen log."
    }
}
