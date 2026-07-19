//! 便携模式运行时路径解析。
//!
//! 便携模式由可执行文件同级的 `SY-TFM.portable` 标记文件显式启用。
//! 它只改变应用数据落点，不替代 Windows Credential Manager；跨设备密码
//! 迁移仍必须通过加密保险库完成。

use std::path::{Path, PathBuf};

use crate::enums::app_directory::AppDirectory;
use crate::enums::app_file::AppFile;
use crate::enums::ErrorCode;
use crate::error::AppError;

/// 解析当前可执行文件是否以便携模式运行及其数据目录。
pub(crate) fn portable_data_dir() -> Result<Option<PathBuf>, AppError> {
    let executable = std::env::current_exe().map_err(storage_path_error)?;
    Ok(resolve_portable_data_dir(&executable))
}

fn resolve_portable_data_dir(executable: &Path) -> Option<PathBuf> {
    let directory = executable.parent()?;
    let marker = directory.join(AppFile::PortableModeMarker.as_str());
    marker
        .is_file()
        .then(|| directory.join(AppDirectory::PortableData.as_str()))
}

fn storage_path_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::StorageReadFailed, error.to_string())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::resolve_portable_data_dir;
    use crate::enums::app_directory::AppDirectory;
    use crate::enums::app_file::AppFile;

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("sy-tfm-portable-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn marker_enables_a_sibling_data_directory() {
        let directory = TestDir::new();
        let executable = directory.0.join("SY-TFM.exe");
        std::fs::write(directory.0.join(AppFile::PortableModeMarker.as_str()), []).expect("marker");

        assert_eq!(
            resolve_portable_data_dir(&executable),
            Some(directory.0.join(AppDirectory::PortableData.as_str()))
        );
    }

    #[test]
    fn normal_builds_do_not_use_a_sibling_data_directory() {
        let directory = TestDir::new();
        assert_eq!(
            resolve_portable_data_dir(&directory.0.join("SY-TFM.exe")),
            None
        );
    }
}
