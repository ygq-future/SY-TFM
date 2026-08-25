import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import * as tauri from '../lib/tauri';
import type { RemoteHost } from '../types/generated/RemoteHost';
import { useConnectionStore } from './connectionStore';

vi.mock('../lib/tauri', () => ({
  getHosts: vi.fn(),
  reorderHosts: vi.fn(),
  addFavoriteFolders: vi.fn(),
}));

function host(id: string, password: string): RemoteHost {
  return {
    id,
    name: id,
    protocol: 'sftp',
    host: `${id}.example.com`,
    port: 22,
    username: 'user',
    password,
    tags: '',
    favoriteFolders: [],
    downloadPath: null,
    https: true,
    basePath: null,
    sftpHostKeyFingerprint: null,
  };
}

describe('connection store host ordering', () => {
  beforeEach(() => {
    useConnectionStore.setState(useConnectionStore.getInitialState(), true);
    vi.resetAllMocks();
  });

  it('optimistically reorders hosts and persists only their IDs without touching secrets', async () => {
    const hosts = [host('a', 'secret-a'), host('b', 'secret-b'), host('c', 'secret-c')];
    useConnectionStore.setState({ hosts });
    (tauri.reorderHosts as MockedFunction<typeof tauri.reorderHosts>).mockResolvedValue();

    await useConnectionStore.getState().reorderHosts('b', 'a');

    expect(useConnectionStore.getState().hosts.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(useConnectionStore.getState().hosts.map((item) => item.password)).toEqual([
      'secret-b',
      'secret-a',
      'secret-c',
    ]);
    expect(tauri.reorderHosts).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('refreshes polled hosts without entering loading state or replacing unchanged data', async () => {
    const hosts = [host('a', 'secret-a')];
    useConnectionStore.setState({ hosts, isLoading: false });
    (tauri.getHosts as MockedFunction<typeof tauri.getHosts>).mockResolvedValue(
      structuredClone(hosts),
    );

    await useConnectionStore.getState().refreshHosts();

    expect(useConnectionStore.getState().hosts).toBe(hosts);
    expect(useConnectionStore.getState().isLoading).toBe(false);
  });

  it('updates only the target host after adding favorite folders', async () => {
    const hosts = [host('a', 'secret-a'), host('b', 'secret-b')];
    useConnectionStore.setState({ hosts });
    const favoriteFolders = [{ name: 'docs', path: '/docs' }];
    (tauri.addFavoriteFolders as MockedFunction<typeof tauri.addFavoriteFolders>).mockResolvedValue(
      favoriteFolders,
    );

    await useConnectionStore.getState().addFavoriteFolders('b', favoriteFolders);

    expect(useConnectionStore.getState().hosts[0]?.favoriteFolders).toEqual([]);
    expect(useConnectionStore.getState().hosts[1]?.favoriteFolders).toEqual(favoriteFolders);
    expect(tauri.addFavoriteFolders).toHaveBeenCalledWith('b', favoriteFolders);
  });
});
