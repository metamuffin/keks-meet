import { log } from "../logger.ts";

//! I am not a crypto expert at all! Please read carefully and report any issues to me. 

export async function crypto_seeded_key(seed: string): Promise<CryptoKey> {
    if (seed.length < 8) log({ scope: "crypto", warn: true }, "Room name is very short. e2ee is insecure!")

    log("crypto", "importing seed…")
    const seed_key = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(seed),
        "PBKDF2",
        false,
        ["deriveKey"]
    )
    //? TODO is it possible to use a unique seed per session here? 
    // const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const salt = base64_to_buf("thisisagoodsaltAAAAAAA==") // valid "unique" 16-byte base-64 string
    log("crypto", "deriving key…")
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 250000,
            hash: "SHA-256",
        },
        seed_key,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    )
    console.log(key);
    log("crypto", "ready")
    return key
}

export async function crypt_hash(input: string): Promise<string> {
    const buf = new TextEncoder().encode("also-a-very-good-salt" + input)
    const h = await window.crypto.subtle.digest({ name: "SHA-256" }, buf)
    const hex = buf_to_hex(new Uint8Array(h))
    return hex
}

export async function crypto_encrypt(key: CryptoKey, data: string): Promise<string> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(data)
    ));
    const buf = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    buf.set(iv, 0);
    buf.set(ciphertext, iv.byteLength);
    const b64 = buf_to_base64(buf);
    return b64;
}

export async function crypt_decrypt(key: CryptoKey, data: string): Promise<string> {
    const buf = base64_to_buf(data);
    const iv = buf.slice(0, 12);
    const ciphertext = buf.slice(12);
    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
    );
    const plain = new TextDecoder().decode(decryptedContent);
    return plain
}

export function base64_to_buf(data: string): Uint8Array {
    const binary_string = globalThis.atob(data);
    const bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

export function buf_to_base64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
}

export function buf_to_hex(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
