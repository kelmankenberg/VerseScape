const SCHEME = 'versescape';

export interface ResourceAssetRequest {
  id: string;
  relativePath: string;
}

export function parseResourceAssetUrl(value: string): ResourceAssetRequest | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== `${SCHEME}:` || url.hostname !== 'resource') return null;

  let segments: string[];
  try {
    segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const [id, ...path] = segments;
  if (
    !id ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) ||
    path.length === 0 ||
    path.some(
      (segment) =>
        segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'),
    )
  ) {
    return null;
  }

  return { id, relativePath: path.join('/') };
}
