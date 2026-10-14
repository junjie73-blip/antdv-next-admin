import { describe, expect, it } from 'vitest';

import { buildUrl } from '../src/url';

describe('buildUrl (qs)', () => {
  it('plain params serialize as key=value pairs', () => {
    expect(buildUrl('/api/list', { a: 1, b: 'x y' })).toBe(
      '/api/list?a=1&b=x%20y',
    );
  });

  it('arrays serialize as repeated keys (Nitro/h3 restores real arrays)', () => {
    expect(buildUrl('/l', { dateRange: ['2026-01-01', '2026-01-02'] })).toBe(
      '/l?dateRange=2026-01-01&dateRange=2026-01-02',
    );
  });

  it('nested objects serialize with bracket notation', () => {
    expect(buildUrl('/l', { filter: { status: 'on' } })).toBe(
      '/l?filter%5Bstatus%5D=on',
    );
  });

  it('skips nil values like the previous hand-rolled serializer', () => {
    expect(buildUrl('/l', { a: null, b: undefined, c: 0, d: false })).toBe(
      '/l?c=0&d=false',
    );
  });

  it('appends to an existing query string', () => {
    expect(buildUrl('/l?base=1', { a: 2 })).toBe('/l?base=1&a=2');
  });

  it('returns the url untouched when there is nothing to send', () => {
    expect(buildUrl('/l')).toBe('/l');
    expect(buildUrl('/l', {})).toBe('/l');
    expect(buildUrl('/l', { a: null })).toBe('/l');
  });

  it('empty arrays produce no query', () => {
    expect(buildUrl('/l', { ids: [] })).toBe('/l');
  });
});
