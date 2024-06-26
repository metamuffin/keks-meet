/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use aes_gcm::{
    aead::{generic_array::sequence::GenericSequence, Aead},
    Aes256Gcm, KeyInit, Nonce,
};
use base64::Engine;
use log::info;

pub struct Key(Aes256Gcm);

const CRYPTO_SALT: &str = "keksmeet/cryptosaltAAA==";
const HASH_SALT: &str = "keksmeet/roomhashsaltA==";

impl Key {
    pub fn derive(secret: &str) -> Self {
        info!("running key generation...");
        let salt = base64::engine::general_purpose::STANDARD
            .decode(CRYPTO_SALT)
            .unwrap();
        let mut key = [0u8; 64];
        fastpbkdf2::pbkdf2_hmac_sha512(secret.as_bytes(), salt.as_slice(), 250000, &mut key);

        let key = Aes256Gcm::new_from_slice(&key[0..32]).unwrap();

        info!("done");
        Self(key)
    }
    pub fn encrypt(&self, s: &str) -> String {
        let iv = Nonce::generate(|_| rand::random()); // TODO check if this is secure randomness
        let ciphertext = self.0.encrypt(&iv, s.as_bytes()).unwrap();
        let mut packet = iv.to_vec(); // TODO this could be doing less allocations
        packet.extend(ciphertext);
        base64::engine::general_purpose::STANDARD.encode(packet)
    }
    pub fn decrypt(&self, s: &str) -> String {
        let r = base64::engine::general_purpose::STANDARD.decode(s).unwrap();
        let iv = &r[0..12];
        let ciphertext = &r[12..];
        let plaintext = self.0.decrypt(Nonce::from_slice(iv), ciphertext).unwrap();
        String::from_utf8(plaintext).unwrap()
    }
}

pub fn hash(secret: &str) -> String {
    let salt = base64::engine::general_purpose::STANDARD
        .decode(HASH_SALT)
        .unwrap();
    let mut key = [0u8; 64];
    fastpbkdf2::pbkdf2_hmac_sha512(secret.as_bytes(), salt.as_slice(), 250000, &mut key);
    hex::encode(&key[0..32])
}
