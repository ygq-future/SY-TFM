//! Android MediaStore bridge for publishing downloads to shared storage.

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{plugin::PluginHandle, plugin::TauriPlugin, Wry};

const PLUGIN_IDENTIFIER: &str = "com.sy.tfm.androidstorage";
const PLUGIN_CLASS: &str = "AndroidStoragePlugin";

static ANDROID_HANDLE: OnceLock<PluginHandle<Wry>> = OnceLock::new();

/// Errors returned by the Android shared-storage bridge.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The native plugin has not completed initialization.
    #[error("Android shared storage is not initialized")]
    NotInitialized,
    /// The native Android plugin rejected the operation.
    #[error("Android shared storage failed: {0}")]
    Plugin(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishPayload<'a> {
    source_path: &'a str,
    display_name: &'a str,
    relative_directory: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportImagePayload<'a> {
    uri: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportImageResponse {
    path: String,
}

/// Builds the Android shared-storage plugin.
pub fn init() -> TauriPlugin<Wry> {
    tauri::plugin::Builder::new("android-storage")
        .setup(|_app, api| {
            let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, PLUGIN_CLASS)?;
            ANDROID_HANDLE.set(handle).map_err(|_| {
                std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    "Android shared storage initialized more than once",
                )
            })?;
            Ok(())
        })
        .build()
}

/// Publishes an app-private staging file into the public Downloads collection.
pub fn publish(
    source_path: &str,
    display_name: &str,
    relative_directory: &str,
) -> Result<(), Error> {
    handle()?
        .run_mobile_plugin::<()>(
            "publish",
            PublishPayload {
                source_path,
                display_name,
                relative_directory,
            },
        )
        .map_err(|error| Error::Plugin(error.to_string()))
}

/// Copies a temporary Android content URI into app-private persistent storage.
pub fn import_image(uri: &str) -> Result<String, Error> {
    let response = handle()?
        .run_mobile_plugin::<ImportImageResponse>("importImage", ImportImagePayload { uri })
        .map_err(|error| Error::Plugin(error.to_string()))?;
    Ok(response.path)
}

fn handle() -> Result<&'static PluginHandle<Wry>, Error> {
    ANDROID_HANDLE.get().ok_or(Error::NotInitialized)
}
