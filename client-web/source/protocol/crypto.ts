import { log } from "../logger.ts";

//! I am not a crypto expert at all! Please read carefully and report any issues to me. 

const IV_LENGTH = 12

export async function crypto_seeded_key(seed: string): Promise<CryptoKey> {
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
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
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
    try {
        const buf = base64_to_buf(data);
        const iv = buf.slice(0, IV_LENGTH);
        const ciphertext = buf.slice(IV_LENGTH);
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );
        const plain = new TextDecoder().decode(decryptedContent);
        return plain
    } catch (_e) {
        log({ scope: "crypto", warn: true }, "unable to decrypt")
        return "{}" // :)
    }
}

//* Code that might be useful in the future for signing
// const ECDSA_PARAMS = { name: "ECDSA", namedCurve: "P-521", hash: { name: "SHA-384" } }
// export async function crypto_sign(key: CryptoKey, message: string): Promise<string> {
//     const signature = await crypto.subtle.sign(
//         ECDSA_PARAMS,
//         key,
//         new TextEncoder().encode(message)
//     )
//     return buf_to_base64(new Uint8Array(signature))
// }
// export async function crypto_generate_signing_key(): Promise<CryptoKeyPair> {
//     return await crypto.subtle.generateKey(
//         ECDSA_PARAMS,
//         false,
//         ["sign", "verify"]
//     )
// }
// export async function crypto_verify(key: CryptoKey, message: string, signature: string): Promise<boolean> {
//     return await crypto.subtle.verify(
//         ECDSA_PARAMS,
//         key,
//         base64_to_buf(signature).buffer,
//         new TextEncoder().encode(message)
//     )
// }
// export async function export_public_signing_key(key: CryptoKey): Promise<string> {
//     const buf = await crypto.subtle.exportKey("spki", key)
//     return buf_to_base64(new Uint8Array(buf))
// }
// export async function import_public_signing_key(der: string): Promise<CryptoKey | undefined> {
//     const bin_der = base64_to_buf(der).buffer; // TODO safety
//     return await crypto.subtle.importKey("spki", bin_der, ECDSA_PARAMS, true, ["verify"]) // TODO safety
// }

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
