//! 配置迁移：v1（SY-FTP 明文）→ v2 → v3（SY-TFM，当前）。
//!
//! 完整迁移逻辑见 `docs/04-data-model.md` §8，Phase 0 任务 0.8 实现。

use std::path::Path;

use crate::error::AppError;
use crate::models::AppSettings;

/// 从 v1（旧版 SY-FTP）迁移到 v3（SY-TFM）。
///
/// Phase 0 占位：返回默认配置。完整实现（端口推断协议、明文密码升级加密）见任务 0.8。
pub fn migrate_v1_to_v3(_old_path: &Path, _new_path: &Path) -> Result<AppSettings, AppError> {
    Err(AppError::unsupported("配置迁移 migrate_v1_to_v3 尚未实现（Phase 0 任务 0.8）"))
}
