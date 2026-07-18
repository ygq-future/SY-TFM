#![allow(unknown_lints)]
#![allow(linker_messages)]

//! ts-rs 类型导出测试。
//!
//! 运行 `cargo test --test export_types`（或 `bun run types:export`）后，
//! TypeScript 类型将生成到 `src/types/enums/` 与 `src/types/generated/`。
//! 生成文件禁止手工编辑（AGENTS.md §6）。

use sy_tfm_lib::enums::*;
use sy_tfm_lib::models::*;
use ts_rs::TS;

#[test]
fn export_all_types() {
    // 全局枚举
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
    HttpScheme::export_all().unwrap();

    // 核心数据模型
    RemoteHost::export_all().unwrap();
    RemoteFile::export_all().unwrap();
    AppSettings::export_all().unwrap();
    HostDto::export_all().unwrap();
    ProgressPayload::export_all().unwrap();
    BatchProgressPayload::export_all().unwrap();
    ConnectionStatusPayload::export_all().unwrap();
    StoragePaths::export_all().unwrap();
    DownloadRequest::export_all().unwrap();
    RemoteEditSessionInfo::export_all().unwrap();
    EditorSyncedPayload::export_all().unwrap();
    EditorErrorPayload::export_all().unwrap();
    EditorSessionInvalidPayload::export_all().unwrap();
}
