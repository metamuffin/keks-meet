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
