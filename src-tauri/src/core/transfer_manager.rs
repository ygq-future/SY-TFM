//! 活跃传输注册表：为并发任务提供独立取消信号。

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{watch, RwLock};
use uuid::Uuid;

use crate::enums::ErrorCode;
use crate::error::AppError;

struct ActiveTransfer {
    host_ids: Vec<Uuid>,
    cancellation: watch::Sender<bool>,
}

/// 管理当前活跃传输及其取消信号。
#[derive(Clone, Default)]
pub struct TransferManager {
    operations: Arc<RwLock<HashMap<String, ActiveTransfer>>>,
}

impl TransferManager {
    /// 创建空的传输注册表。
    pub fn new() -> Self {
        Self::default()
    }

    /// 注册一个前端生成的操作 ID。
    pub async fn begin(&self, operation_id: String, host_ids: Vec<Uuid>) {
        let (cancellation, _) = watch::channel(false);
        self.operations.write().await.insert(
            operation_id,
            ActiveTransfer {
                host_ids,
                cancellation,
            },
        );
    }

    /// 订阅指定操作的取消信号。
    pub async fn cancellation(
        &self,
        operation_id: &str,
    ) -> Result<watch::Receiver<bool>, AppError> {
        self.operations
            .read()
            .await
            .get(operation_id)
            .map(|transfer| transfer.cancellation.subscribe())
            .ok_or_else(|| AppError::new(ErrorCode::OperationCancelled, "传输任务不存在或已经结束"))
    }

    /// 请求取消单个操作。
    pub async fn cancel(&self, operation_id: &str) -> bool {
        if let Some(transfer) = self.operations.read().await.get(operation_id) {
            transfer.cancellation.send_replace(true);
            true
        } else {
            false
        }
    }

    /// 取消涉及指定主机的全部传输，使断开连接不会等待网络任务。
    pub async fn cancel_host(&self, host_id: Uuid) -> usize {
        let operations = self.operations.read().await;
        operations
            .values()
            .filter(|transfer| transfer.host_ids.contains(&host_id))
            .map(|transfer| {
                transfer.cancellation.send_replace(true);
            })
            .count()
    }

    /// 从注册表移除已完成的操作。
    pub async fn finish(&self, operation_id: &str) {
        self.operations.write().await.remove(operation_id);
    }
}

#[cfg(test)]
mod tests {
    use super::TransferManager;
    use uuid::Uuid;

    #[tokio::test]
    async fn cancellation_is_scoped_to_the_selected_operation() {
        let manager = TransferManager::new();
        let host = Uuid::new_v4();
        manager.begin("download".to_string(), vec![host]).await;
        manager.begin("upload".to_string(), vec![host]).await;
        let download = manager.cancellation("download").await;
        let upload = manager.cancellation("upload").await;
        assert!(download.is_ok());
        assert!(upload.is_ok());
        let mut download = download.unwrap_or_else(|_| unreachable!());
        let upload = upload.unwrap_or_else(|_| unreachable!());

        assert!(manager.cancel("download").await);
        assert!(download.changed().await.is_ok());
        assert!(*download.borrow());
        assert!(!*upload.borrow());
    }

    #[tokio::test]
    async fn cancelling_a_host_notifies_every_related_transfer() {
        let manager = TransferManager::new();
        let host = Uuid::new_v4();
        manager.begin("one".to_string(), vec![host]).await;
        manager.begin("two".to_string(), vec![host]).await;

        assert_eq!(manager.cancel_host(host).await, 2);
    }
}
