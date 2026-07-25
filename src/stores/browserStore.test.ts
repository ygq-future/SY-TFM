import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import * as tauri from '../lib/tauri';
import { useBrowserStore } from './browserStore';
import type { RemoteFile } from '../types/generated/RemoteFile';

vi.mock('../lib/tauri', () => ({
  getWorkingDirectory: vi.fn(),
  listDirectory: vi.fn(),
  beginTransfer: vi.fn(),
  downloadFile: vi.fn(),
  finishTransfer: vi.fn(),
  cancelTransfer: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('browser store pane ownership', () => {
  beforeEach(() => {
    useBrowserStore.setState(useBrowserStore.getInitialState(), true);
    vi.resetAllMocks();
  });

  it('does not let a stale host request overwrite a newly activated host', async () => {
    const hostAHome = deferred<string>();
    (
      tauri.getWorkingDirectory as MockedFunction<typeof tauri.getWorkingDirectory>
    ).mockImplementation((hostId) =>
      hostId === 'host-a' ? hostAHome.promise : Promise.resolve('/home/b'),
    );
    (tauri.listDirectory as MockedFunction<typeof tauri.listDirectory>).mockResolvedValue([]);

    const requestA = useBrowserStore.getState().initializeDirectory(0, 'host-a');
    const requestB = useBrowserStore.getState().initializeDirectory(0, 'host-b');
    await requestB;
    hostAHome.resolve('/home/a');
    await requestA;

    const pane = useBrowserStore.getState().panes[0];
    expect(pane.hostId).toBe('host-b');
    expect(pane.homePath).toBe('/home/b');
    expect(pane.currentPath).toBe('/home/b');
    expect(pane.files[0]?.name).toBe('..');
  });

  it('sorts the current pane immediately by name, size, and modified time', () => {
    const files: RemoteFile[] = [
      {
        name: 'b.txt',
        fullPath: '/b.txt',
        size: 20,
        isDirectory: false,
        lastModified: '2026-01-02 12:00',
        owner: '1000:1000',
        permissions: 'rw-r--r--',
      },
      {
        name: 'a.txt',
        fullPath: '/a.txt',
        size: 10,
        isDirectory: false,
        lastModified: '2026-01-01 12:00',
        owner: '1000:1000',
        permissions: 'rw-r--r--',
      },
    ];
    useBrowserStore.setState((state) => ({
      panes: [{ ...state.panes[0], files }, state.panes[1]],
    }));

    useBrowserStore.getState().toggleSort(0, 'name');
    expect(useBrowserStore.getState().panes[0].files.map((file) => file.name)).toEqual([
      'b.txt',
      'a.txt',
    ]);
    useBrowserStore.getState().toggleSort(0, 'size');
    expect(useBrowserStore.getState().panes[0].files.map((file) => file.size)).toEqual([10, 20]);
    useBrowserStore.getState().toggleSort(0, 'lastModified');
    expect(useBrowserStore.getState().panes[0].files.map((file) => file.lastModified)).toEqual([
      '2026-01-01 12:00',
      '2026-01-02 12:00',
    ]);
  });

  it('passes the base directory and raw remote name to the download boundary', async () => {
    const file: RemoteFile = {
      name: '../unsafe.txt',
      fullPath: '/remote/unsafe.txt',
      size: 10,
      isDirectory: false,
      lastModified: '2026-01-01 12:00',
      owner: null,
      permissions: null,
    };
    useBrowserStore.setState((state) => ({
      panes: [{ ...state.panes[0], selectedFiles: [file] }, state.panes[1]],
    }));
    (tauri.beginTransfer as MockedFunction<typeof tauri.beginTransfer>).mockResolvedValue();
    (tauri.downloadFile as MockedFunction<typeof tauri.downloadFile>).mockResolvedValue();
    (tauri.finishTransfer as MockedFunction<typeof tauri.finishTransfer>).mockResolvedValue();

    await useBrowserStore.getState().downloadSelected(0, 'host-a', 'C:\\Downloads');

    expect(tauri.downloadFile).toHaveBeenCalledWith(
      'host-a',
      '/remote/unsafe.txt',
      'C:\\Downloads',
      '../unsafe.txt',
      false,
      expect.any(String),
    );
  });

  it('enters cancelling state before the native cancellation request returns', async () => {
    const cancellation = deferred<boolean>();
    (tauri.cancelTransfer as MockedFunction<typeof tauri.cancelTransfer>).mockReturnValue(
      cancellation.promise,
    );
    useBrowserStore.getState().startTransfer({
      operationId: 'folder-download',
      hostId: 'host-a',
      isActive: true,
      isSuccessful: false,
      isCancelling: false,
      isCancelled: false,
      percent: 42,
      message: 'Downloading',
      direction: 'remoteToLocal',
      currentIndex: 42,
      totalCount: 100,
      speed: 1024,
    });

    const request = useBrowserStore.getState().cancelTransfer('folder-download');
    expect(useBrowserStore.getState().transfers['folder-download']?.isCancelling).toBe(true);
    expect(useBrowserStore.getState().transfers['folder-download']?.percent).toBe(42);
    cancellation.resolve(true);
    await request;
  });

  it('clears both stale operation text and its error styling', () => {
    useBrowserStore
      .getState()
      .setOperationMessage('The edit session ended because its host disconnected', true);
    useBrowserStore.getState().clearOperationMessage();

    expect(useBrowserStore.getState().operationMessage).toBe('');
    expect(useBrowserStore.getState().operationIsError).toBe(false);
  });

  it('only clears the operation notice owned by the closing editor', () => {
    useBrowserStore.getState().setOperationMessage('Opened notes.txt in Online Edit');
    useBrowserStore.getState().setOperationMessage('A newer transfer failed', true);

    useBrowserStore.getState().clearOperationMessage('Opened notes.txt in Online Edit');
    expect(useBrowserStore.getState().operationMessage).toBe('A newer transfer failed');
    expect(useBrowserStore.getState().operationIsError).toBe(true);

    useBrowserStore.getState().clearOperationMessage('A newer transfer failed');
    expect(useBrowserStore.getState().operationMessage).toBe('');
    expect(useBrowserStore.getState().operationIsError).toBe(false);
  });

  it('clears cached directory data when its host disconnects', () => {
    useBrowserStore.setState((state) => ({
      panes: [
        {
          ...state.panes[0],
          hostId: 'host-a',
          currentPath: '/workspace',
          files: [
            {
              name: 'README.md',
              fullPath: '/workspace/README.md',
              size: 42,
              isDirectory: false,
              lastModified: '2026-07-19 10:00',
              owner: null,
              permissions: null,
            },
          ],
        },
        state.panes[1],
      ],
    }));

    useBrowserStore.getState().clearDisconnectedPanes([]);

    expect(useBrowserStore.getState().panes[0]).toMatchObject({
      hostId: null,
      files: [],
      currentPath: '/',
      selectedFiles: [],
    });
  });
});
