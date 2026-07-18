import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import * as tauri from '../lib/tauri';
import type { RemoteHost } from '../types/generated/RemoteHost';
import { useConnectionStore } from './connectionStore';

vi.mock('../lib/tauri', () => ({
  reorderHosts: vi.fn(),
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
});
