import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '../../lib/i18n';
import { useConnectionStore } from '../../stores/connectionStore';
import { HostEditDialog, normalizeHostForm, updateHostForm } from './HostEditDialog';
import type { RemoteHost } from '../../types/generated/RemoteHost';

describe('HostEditDialog', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh');
  });
  it('uses the shared styled selector and includes the host download path', () => {
    useConnectionStore.setState({ addHost: vi.fn(), updateHost: vi.fn() });
    const markup = renderToStaticMarkup(<HostEditDialog host={null} onClose={vi.fn()} />);

    expect(markup).not.toContain('<select');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('SFTP');
    expect(markup).toContain('SSH 文件传输');
    expect(markup).toContain('WebDAV');
    expect(markup).toContain('HTTP 文件服务');
    expect(markup).toContain('下载路径');
    expect(markup).toContain('留空则使用全局下载目录');
  });

  it('places tags beside the name and gives the download path a full row', () => {
    useConnectionStore.setState({ addHost: vi.fn(), updateHost: vi.fn() });
    const markup = renderToStaticMarkup(<HostEditDialog host={null} onClose={vi.fn()} />);

    expect(markup.indexOf('空间名称')).toBeLessThan(markup.indexOf('标签'));
    expect(markup.indexOf('标签')).toBeLessThan(markup.indexOf('主机地址'));
    expect(markup).toContain('class="field-download"');
  });

  it('uses WebDAV URL, HTTP scheme and optional base path instead of a port switch', () => {
    useConnectionStore.setState({ addHost: vi.fn(), updateHost: vi.fn() });
    const markup = renderToStaticMarkup(
      <HostEditDialog
        host={{
          id: crypto.randomUUID(),
          name: 'alist',
          protocol: 'webdav',
          host: 'dav.example.com/team/dav',
          port: 0,
          username: 'user',
          password: '',
          tags: '',
          downloadPath: null,
          https: true,
          basePath: null,
          sftpHostKeyFingerprint: null,
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('WebDAV URL');
    expect(markup).toContain('HTTP / HTTPS');
    expect(markup).toContain('可选基础路径');
    expect(markup).not.toContain('使用 HTTPS');
    expect(markup).not.toContain('端口');
  });

  it('offers a test connection action for both create and edit flows', () => {
    const source = readFileSync(new URL('./HostEditDialog.tsx', import.meta.url), 'utf8');
    expect(source).toContain('testHostConnection');
    expect(source).toContain("t('hostEditor.testConnection')");
  });

  it('uses a generic WebDAV URL example', () => {
    const zh = readFileSync(new URL('../../locales/zh.json', import.meta.url), 'utf8');
    expect(zh).toContain('dav.example.com/remote.php/dav');
    expect(zh).not.toContain('alist.sheepyu.top');
  });

  it('keeps the protocol caption independent from the selector and aligned with field labels', () => {
    const source = readFileSync(new URL('./HostEditDialog.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(source).not.toContain('<label htmlFor="host-protocol"');
    expect(source).toContain('className="field-label protocol-picker-label"');
    expect(css).toMatch(/\.protocol-picker-label\s*\{[^}]*font-size:\s*var\(--type-label-size\)/s);
  });

  it('keeps the saved-password status and action on one compact line', () => {
    const source = readFileSync(new URL('./HostEditDialog.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(source).toContain('className="saved-password-status"');
    expect(css).toMatch(/\.saved-password-row\s*\{[^}]*white-space:\s*nowrap/s);
    expect(css).toMatch(/\.saved-password-status\s*\{[^}]*text-overflow:\s*ellipsis/s);
  });

  it('normalizes WebDAV hosts without carrying an SFTP fingerprint', () => {
    expect(
      normalizeHostForm({
        id: crypto.randomUUID(),
        name: 'dav',
        protocol: 'webdav',
        host: 'https://dav.example.com/root/',
        port: 443,
        username: 'alice',
        password: '',
        tags: '',
        downloadPath: null,
        https: false,
        basePath: null,
        sftpHostKeyFingerprint: 'SHA256:stale',
      }),
    ).toMatchObject({
      host: 'dav.example.com/root',
      port: 0,
      https: true,
      sftpHostKeyFingerprint: null,
    });
  });

  it('clears trust only when SFTP identity fields change', () => {
    const host: RemoteHost = {
      id: crypto.randomUUID(),
      name: 'server',
      protocol: 'sftp',
      host: 'sftp.example.com',
      port: 22,
      username: 'alice',
      password: '',
      tags: '',
      downloadPath: null,
      https: true,
      basePath: null,
      sftpHostKeyFingerprint: 'SHA256:trusted',
    };

    expect(updateHostForm(host, { username: 'bob' }).sftpHostKeyFingerprint).toBe('SHA256:trusted');
    expect(updateHostForm(host, { host: 'other.example.com' }).sftpHostKeyFingerprint).toBeNull();
    expect(updateHostForm(host, { port: 2222 }).sftpHostKeyFingerprint).toBeNull();
    expect(updateHostForm(host, { protocol: 'webdav' }).sftpHostKeyFingerprint).toBeNull();
  });

  it('requires confirmation before a test trusts and retries an unknown key', () => {
    const source = readFileSync(new URL('./HostEditDialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('getHostKeyUnknownDetails(error)');
    expect(source).toContain('setPendingHostKey');
    expect(source).toContain('sftpHostKeyFingerprint: pending.fingerprint');
    expect(source).toContain('void testConnection(trustedHost, pending.password)');
    expect(source).toContain('onCancel={() => setPendingHostKey(null)}');
    expect(source).not.toContain('updateHost(trustedHost)');
  });
});
