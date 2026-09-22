export const SUPPORTED_NODE_RANGE = '^20.19.0 || >=22.12.0';

export function parseNodeVersion(version) {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return undefined;

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function isSupportedNodeVersion(version) {
  const parsed = parseNodeVersion(version);
  if (!parsed) return false;

  if (parsed.major === 20) {
    return parsed.minor > 19 || (parsed.minor === 19 && parsed.patch >= 0);
  }

  if (parsed.major < 22) return false;
  if (parsed.major > 22) return true;
  return parsed.minor > 12 || (parsed.minor === 12 && parsed.patch >= 0);
}
