/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
export interface SWMessage {
    download?: { path: string, size: number }
    check_version?: boolean,
    update?: boolean,

    version_info?: { installed_version: string, available_version: string }
    updated?: boolean
}
