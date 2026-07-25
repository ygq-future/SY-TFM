//! Android Keystore-backed secret persistence for SY-TFM.

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{plugin::PluginHandle, plugin::TauriPlugin, Wry};

const PLUGIN_IDENTIFIER: &str = "com.sy.tfm.securestorage";
const PLUGIN_CLASS: &str = "SecureStoragePlugin";

static ANDROID_HANDLE: OnceLock<PluginHandle<Wry>> = OnceLock::new();

/// Errors returned by the Android secure storage bridge.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The native plugin has not completed initialization.
    #[error("Android secure storage is not initialized")]
    NotInitialized,
    /// The native Android plugin rejected the operation.
    #[error("Android secure storage failed: {0}")]
    Plugin(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountPayload<'a> {
    account: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SetPayload<'a> {
    account: &'a str,
    value: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetResponse {
    value: Option<String>,
}

/// Builds the Android native secure-storage plugin.
pub fn init() -> TauriPlugin<Wry> {
    tauri::plugin::Builder::new("secure-storage")
        .setup(|_app, api| {
            let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, PLUGIN_CLASS)?;
            ANDROID_HANDLE.set(handle).map_err(|_| {
                std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    "Android secure storage initialized more than once",
                )
            })?;
            Ok(())
        })
        .build()
}

/// Reads a secret by account name.
pub fn get(account: &str) -> Result<Option<String>, Error> {
    let response = handle()?
        .run_mobile_plugin::<GetResponse>("get", AccountPayload { account })
        .map_err(|error| Error::Plugin(error.to_string()))?;
    Ok(response.value)
}

/// Stores a secret by account name.
pub fn set(account: &str, value: &str) -> Result<(), Error> {
    handle()?
        .run_mobile_plugin::<()>("set", SetPayload { account, value })
        .map_err(|error| Error::Plugin(error.to_string()))
}

/// Deletes a secret by account name.
pub fn delete(account: &str) -> Result<(), Error> {
    handle()?
        .run_mobile_plugin::<()>("delete", AccountPayload { account })
        .map_err(|error| Error::Plugin(error.to_string()))
}

fn handle() -> Result<&'static PluginHandle<Wry>, Error> {
    ANDROID_HANDLE.get().ok_or(Error::NotInitialized)
}
