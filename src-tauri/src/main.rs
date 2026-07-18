// 在 release 模式下隐藏 Windows 控制台窗口
#![allow(unknown_lints)]
#![allow(linker_messages)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sy_tfm_lib::run();
}
