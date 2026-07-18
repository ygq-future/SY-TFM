import { describe, expect, it } from 'vitest';
import {
  formatAppError,
  getHostKeyChangedDetails,
  getHostKeyUnknownDetails,
  hasAppErrorCode,
} from './errors';

describe('formatAppError', () => {
  it('extracts a serialized AppError message', () => {
    expect(formatAppError({ code: 'connection_failed', message: '连接失败' })).toBe('连接失败');
  });

  it('handles native and string errors', () => {
    expect(formatAppError(new Error('boom'))).toBe('boom');
    expect(formatAppError('plain')).toBe('plain');
  });

  it('recognizes structured backend error codes', () => {
    expect(hasAppErrorCode({ code: 'crypto_decrypt_failed' }, 'crypto_decrypt_failed')).toBe(true);
    expect(hasAppErrorCode(new Error('crypto_decrypt_failed'), 'crypto_decrypt_failed')).toBe(
      false,
    );
  });

  it('safely parses an unknown SFTP host key payload', () => {
    expect(
      getHostKeyUnknownDetails({
        code: 'host_key_unknown',
        details: {
          host: 'sftp.example.com',
          port: 22,
          actualFingerprint: 'SHA256:actual',
        },
      }),
    ).toEqual({
      host: 'sftp.example.com',
      port: 22,
      actualFingerprint: 'SHA256:actual',
    });
    expect(
      getHostKeyUnknownDetails({
        code: 'host_key_unknown',
        details: { host: 'sftp.example.com', port: '22', actualFingerprint: 'SHA256:actual' },
      }),
    ).toBeNull();
  });

  it('safely parses changed host keys and rejects malformed details', () => {
    const error = {
      code: 'host_key_changed',
      message: 'SFTP host key changed, expected SHA256:expected, actual SHA256:actual',
      details: {
        host: 'sftp.example.com',
        port: 2222,
        expectedFingerprint: 'SHA256:expected',
        actualFingerprint: 'SHA256:actual',
      },
    };
    expect(getHostKeyChangedDetails(error)).toEqual({
      host: 'sftp.example.com',
      port: 2222,
      expectedFingerprint: 'SHA256:expected',
      actualFingerprint: 'SHA256:actual',
    });
    expect(formatAppError(error)).toContain('SHA256:expected');
    expect(formatAppError(error)).toContain('SHA256:actual');
    expect(getHostKeyChangedDetails({ code: 'host_key_changed', details: null })).toBeNull();
  });
});
