//! 存储层：settings 读写 + 迁移。

pub mod migration;
pub mod settings;

pub use settings::SettingsService;
