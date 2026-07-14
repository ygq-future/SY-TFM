//! ts-rs 类型导出测试。
//!
//! 运行 `cargo test --test export_types`（或 `bun run types:export`）后，
//! TypeScript 类型将生成到 `src/types/enums/` 与 `src/types/generated/`。
//! 生成文件禁止手工编辑（AGENTS.md §6）。

use sy_tfm::enums::*;
use sy_tfm::models::*;
use ts_rs::TS;

#[test]
fn export_all_types() {
    // 12 个枚举
    Protocol::export_all().unwrap();
    ConnectionStatus::export_all().unwrap();
    Theme::export_all().unwrap();
    Language::export_all().unwrap();
    SortColumn::export_all().unwrap();
    SortOrder::export_all().unwrap();
    ErrorCode::export_all().unwrap();
    FileOperation::export_all().unwrap();
    EditMode::export_all().unwrap();
    Platform::export_all().unwrap();
    TransferDirection::export_all().unwrap();
    AdapterCapability::export_all().unwrap();

    // 核心数据模型
    RemoteHost::export_all().unwrap();
    RemoteFile::export_all().unwrap();
    AppSettings::export_all().unwrap();
}
