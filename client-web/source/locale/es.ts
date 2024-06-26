/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2024 metamuffin <metamuffin.org>
*/
import { LanguageStrings } from "./mod.ts";

// TODO this is mostly autogenerated. please fix it.
export const PO_ES: LanguageStrings = {
    join_message: author => [author, " unir."],
    status_drain_buffer: amount => `Draining buffers... (buffer: ${amount})`,
    enable: thing => `Activar ${thing}`,
    leave_message: author => [author, " salir."],
    microphone: "Microfono",
    chatbox_placeholder: "Escriba un mensaje",
    chatbox_label: "Enviar mensaje",
    summary_empty_message: "(mensaje vacío)",
    summery_image: "(imagen)",
    camera: "Cámara",
    file: "Archivo",
    leave: "Salir",
    screen: "Pantalla",
    image_alt: "Imagen (haga clic para abrir)",
    warn_mem_download: "Descarga a la memoria porque el servicio de trabajo no está disponible.",
    confirm_update: "¿En serio?",
    warn_short_secret: "El nombre de la habitación es muy corto. ¡E2EE es inseguro!",
    warn_secure_context: "Esta página no es un 'Contexto Seguro' '",
    warn_no_webrtc: "WebRTC no es compatible.",
    warn_no_crypto: "SubtleCrypto no disponible",
    warn_no_sw: "Su navegador no admite el Service Worker API, las actualizaciones automáticas forzadas son inevitables.",
    warn_old_url: "Usted fue redireccionado desde el antiguo formato URL. El servidor conoce el secreto de la habitación ahora - E2EE es inseguro!",
    confirm_quit: "Tienes recursos locales compartidos. ¿De verdad renunciaste?",
    controls: "Controles",
    license: "Licencia",
    source_code: "Código fuente",
    stop_sharing: "Deja de compartir",
    documentation: "Documentación",
    known_rooms: "Habitaciones conocidas",
    chat: "Chat",
    settings: "Ajustes",
    edit: "Editar",
    finish_edit: "Edición final",
    add_current_room: "Agregar habitación actual",
    add: "Añadir",
    move_down: "Muévete.",
    move_up: "Muévanse.",
    unknown_user: "Usuario desconocido",
    status_checking: "Comprobando...",
    status_connected: "Conectado",
    status_failed: "La conexión falló",
    status_disconnected: "Desconectado",
    status_no_conn: "No conectado",
    status_await_channel_open: "Esperando que el canal de datos se abra...",
    status_await_channel_close: "Esperando que el canal de datos cierre...",
    downloading: "Descargando...",
    download_again: "Descargar de nuevo",
    download: "Descargar",
    status_buffering: "Buffering...",
    status_closing: "Cierre de canales...",
    mute: "Mute",
    video_stream: "secuencia de vídeo",
    audio_stream: "flujo de audio",
    local: "Local",
    disable: "Desactivar",
    status_await_stream: "A la espera de la corriente...",
    notification_perm_explain: "Para que keks-meet envíe notificaciones, necesita que usted conceda permiso:",
    grant: "Grant",
    clear_prefs: "¿Quieres limpiar todos los ajustes? Usa esto:",
    setting_descs: {
        language: "Lengua de interfacio",
        warn_redirect: "Opción interna que se establece por un servidor redireccionar.",
        image_view_popup: "Imagen abierta en popup en lugar de nueva pestaña",
        webrtc_debug: "Mostrar información adicional para cosas relacionadas con WebRTC",
        screencast_audio: "Incluya el audio al compartir su pantalla.",
        microphone_enabled: "Añadir una pista de micrófono en el arranque",
        screencast_enabled: "Añadir una pista de pantalla en el inicio",
        camera_enabled: "Añadir una pista de cámara en el inicio",
        rnnoise: "Use RNNoise para la supresión del ruido",
        native_noise_suppression: "Sugerir el navegador para hacer la supresión del ruido",
        microphone_gain: "Amplificar el volumen del micrófono",
        video_fps: "Marco preferido (en 1/s) para pantalla y cámara",
        video_resolution: "Resolución horizontal preferida para pantalla y cámara",
        camera_facing_mode: "Preferir cámara de cara al usuario o env-facing",
        auto_gain_control: "Ajuste automático de ganancia de micrófono",
        echo_cancellation: "Cancelar eco",
        audio_activity_threshold: "Nivel de actividad de audio",
        optional_audio_default_enable: "Permitir pistas de audio por defecto",
        optional_video_default_enable: "Permitir pistas de vídeo por defecto",
        notify_chat: "Enviar notificaciones para mensajes de chat entrantes",
        notify_join: "Enviar notificaciones cuando los usuarios se unan",
        notify_leave: "Enviar notificaciones cuando los usuarios dejan",
        enable_onbeforeunload: "Prompt for confirmation when leaving the site while local resources are shared",
        room_watches: "Habitaciones conocidas (como semicolon seperated list of name=secret pairs)",
        username: "Nombre de usuario",
        show_log: "Mostrar registro extendido.",
        preview_rate: "Preview rate",
        send_previews: "Send video previews",
        preview_resolution: "Preview resolution",
        preview_encoding_quality: "Preview encoding quality (0 - 100)",
    }
}
