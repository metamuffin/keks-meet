
export interface SWMessage {
    download?: { path: string, size: number }
    check_version?: boolean,
    update?: boolean,

    version_info?: { installed_version: string, available_version: string }
    updated?: boolean
}
