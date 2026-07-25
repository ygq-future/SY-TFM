import { describe, expect, it } from 'vitest';
import { mergeVaultCredentialStatus, type VaultCredentialDraft } from './vaultCredentialDraft';

describe('WebDAV vault credential draft', () => {
  it('does not overwrite fields already edited while the 30-second status poll refreshes', () => {
    const draft: VaultCredentialDraft = {
      webdavUrl: 'https://cloud.example.com/dav',
      username: 'alice',
      password: 'partially-typed-password',
      webdavUrlEdited: true,
      usernameEdited: true,
    };

    expect(
      mergeVaultCredentialStatus(draft, {
        webdavUrl: '',
        username: '',
      }),
    ).toEqual(draft);
  });

  it('hydrates untouched fields from the first saved status without exposing a password', () => {
    const draft: VaultCredentialDraft = {
      webdavUrl: '',
      username: '',
      password: '',
      webdavUrlEdited: false,
      usernameEdited: false,
    };

    expect(
      mergeVaultCredentialStatus(draft, {
        webdavUrl: 'https://saved.example.com/dav',
        username: 'saved-user',
      }),
    ).toEqual({
      ...draft,
      webdavUrl: 'https://saved.example.com/dav',
      username: 'saved-user',
    });
  });
});
