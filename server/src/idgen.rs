/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
use tokio::sync::RwLock;

pub struct IdGenerator {
    x: RwLock<u64>,
}

impl Default for IdGenerator {
    fn default() -> Self {
        Self {
            x: Default::default(),
        }
    }
}
impl IdGenerator {
    pub async fn generate(&self) -> u64 {
        // TODO: dummy implementation; ideal would be encrypting the counter
        let mut x = self.x.write().await;
        *x += 1;
        *x
    }
}
