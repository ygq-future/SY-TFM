use serde::{Deserialize, Serialize};
use std::ops::{BitAnd, BitAndAssign, BitOr, BitOrAssign};
use ts_rs::TS;

/// Adapter 能力标志位。
///
/// UI 据此数据驱动地决定显示哪些列与操作（如 WebDAV 隐藏 owner/permissions 列）。
/// 前端以数值形式接收，可用位运算判断能力。
///
/// 注：使用 transparent newtype 而非 `bitflags!` 宏，因 ts-rs 11 不支持
/// 在 `bitflags!` 生成的类型上 derive `TS`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/", type = "number")]
pub struct AdapterCapability(pub u32);

impl AdapterCapability {
    /// 无能力
    pub const NONE: Self = Self(0);
    /// 支持所有者/权限信息
    pub const OWNER_PERMISSIONS: Self = Self(1 << 0);
    /// 支持符号链接
    pub const SYMLINKS: Self = Self(1 << 1);
    /// 支持原子重命名
    pub const ATOMIC_RENAME: Self = Self(1 << 2);
    /// 支持 chmod
    pub const CHMOD: Self = Self(1 << 3);
    /// 支持 chown
    pub const CHOWN: Self = Self(1 << 4);
    /// 支持断点/范围传输
    pub const RANGE_TRANSFER: Self = Self(1 << 5);

    /// 检查是否包含指定能力。
    pub fn contains(&self, other: Self) -> bool {
        (self.0 & other.0) == other.0
    }

    /// 检查是否为空。
    pub fn is_empty(&self) -> bool {
        self.0 == 0
    }
}

impl BitOr for AdapterCapability {
    type Output = Self;
    fn bitor(self, rhs: Self) -> Self {
        Self(self.0 | rhs.0)
    }
}

impl BitAnd for AdapterCapability {
    type Output = Self;
    fn bitand(self, rhs: Self) -> Self {
        Self(self.0 & rhs.0)
    }
}

impl BitOrAssign for AdapterCapability {
    fn bitor_assign(&mut self, rhs: Self) {
        self.0 |= rhs.0;
    }
}

impl BitAndAssign for AdapterCapability {
    fn bitand_assign(&mut self, rhs: Self) {
        self.0 &= rhs.0;
    }
}

impl Default for AdapterCapability {
    fn default() -> Self {
        Self::NONE
    }
}
