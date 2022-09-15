use aes_gcm::{
    aead::{generic_array::sequence::GenericSequence, Aead},
    Aes256Gcm, KeyInit, Nonce,
};
use log::info;

pub struct Key(Aes256Gcm);

impl Key {
    pub fn derive(secret: &str) -> Self {
        info!("running key generation... this might take some™ time");
        let salt = base64::decode("thisisagoodsaltAAAAAAA==").unwrap();
        let mut key = [0u8; 32];
        fastpbkdf2::pbkdf2_hmac_sha256(secret.as_bytes(), salt.as_slice(), 250000, &mut key);

        let key = Aes256Gcm::new_from_slice(key.as_slice()).unwrap();

        info!("done");
        Self(key)
    }
    pub fn encrypt(&self, s: &str) -> String {
        let iv = Nonce::generate(|_| rand::random()); // TODO check if this is secure randomness
        let ciphertext = self.0.encrypt(&iv, s.as_bytes()).unwrap();
        let mut packet = iv.to_vec(); // TODO this could be doing less allocations
        packet.extend(ciphertext);
        base64::encode(packet)
    }
    pub fn decrypt(&self, s: &str) -> String {
        let r = base64::decode(s).unwrap();
        let iv = &r[0..12];
        let ciphertext = &r[12..];
        let plaintext = self.0.decrypt(Nonce::from_slice(iv), ciphertext).unwrap();
        String::from_utf8(plaintext).unwrap()
    }
}

pub fn hash(secret: &str) -> String {
    sha256::digest(format!("also-a-very-good-salt{}", secret))
}