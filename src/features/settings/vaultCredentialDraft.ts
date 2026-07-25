/** WebDAV 凭据表单草稿；编辑标记用于抵御后台状态轮询覆盖。 */
export interface VaultCredentialDraft {
  webdavUrl: string;
  username: string;
  password: string;
  webdavUrlEdited: boolean;
  usernameEdited: boolean;
}

interface VaultCredentialStatusFields {
  webdavUrl: string;
  username: string;
}

/** 仅用后端状态填充尚未被用户编辑的字段。 */
export function mergeVaultCredentialStatus(
  draft: VaultCredentialDraft,
  status: VaultCredentialStatusFields,
): VaultCredentialDraft {
  return {
    ...draft,
    webdavUrl: draft.webdavUrlEdited ? draft.webdavUrl : status.webdavUrl,
    username: draft.usernameEdited ? draft.username : status.username,
  };
}
