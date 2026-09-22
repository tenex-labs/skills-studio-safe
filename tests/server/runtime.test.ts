import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_NODE_RANGE,
  isSupportedNodeVersion,
  parseNodeVersion,
} from '../../scripts/runtime.mjs';

describe('Node runtime contract', () => {
  it('parses complete Node versions without accepting partial values', () => {
    expect(parseNodeVersion('v22.12.0')).toEqual({ major: 22, minor: 12, patch: 0 });
    expect(parseNodeVersion('20.19.1-nightly')).toEqual({ major: 20, minor: 19, patch: 1 });
    expect(parseNodeVersion('22.12')).toBeUndefined();
  });

  it(`implements ${SUPPORTED_NODE_RANGE}`, () => {
    expect(isSupportedNodeVersion('20.18.9')).toBe(false);
    expect(isSupportedNodeVersion('20.19.0')).toBe(true);
    expect(isSupportedNodeVersion('20.99.0')).toBe(true);
    expect(isSupportedNodeVersion('21.9.0')).toBe(false);
    expect(isSupportedNodeVersion('22.11.9')).toBe(false);
    expect(isSupportedNodeVersion('22.12.0')).toBe(true);
    expect(isSupportedNodeVersion('23.0.0')).toBe(true);
  });
});
