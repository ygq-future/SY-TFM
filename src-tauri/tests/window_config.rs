//! 发布构建窗口配置回归测试。

#[test]
fn packaged_context_contains_the_main_window() {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let windows = &context.config().app.windows;

    assert_eq!(windows.len(), 1);
    let main = &windows[0];
    assert_eq!(main.label, "main");
    assert!(main.create);
    assert_eq!(main.width, 1060.0);
    assert_eq!(main.height, 700.0);
    assert!(!main.visible);
}
