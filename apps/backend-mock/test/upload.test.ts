import { describe, expect, it } from 'vitest';

import {
  buildUploadResult,
  hashCode,
  nextUploadId,
  pickPalette,
  previewDataUrl,
  resetUploadSeq,
  uploadSuccess,
} from '../server/utils/upload';

/**
 * 「上传」mock 的契约测试。
 *
 * 关心的不是"能不能传成功"（那是 e2e 的事），而是返回结构**能不能被页面直接消费**：
 * antd Upload 把整个响应体挂在 `file.response` 上，页面读 `response.data.url`，
 * 信封少一层或多一层都会退化成"上传成功了，但预览是空的"。
 */
describe('上传结果构造', () => {
  it('信封是 { code, data, message }，页面按 response.data.url 取预览地址', () => {
    const body = uploadSuccess('image', '2026-10-09 10:00:00');
    expect(body.code).toBe(200);
    expect(body.message).toBe('上传成功');
    expect(body.data).toMatchObject({
      storedPath: expect.stringMatching(/^\/uploads\/image\/mock-/),
      uploadedAt: '2026-10-09 10:00:00',
      variant: 'image',
    });
    expect(body.data?.url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('fileId 进程内单调递增，resetUploadSeq 供用例之间复位', () => {
    resetUploadSeq();
    const first = nextUploadId(1_700_000_000_000);
    const second = nextUploadId(1_700_000_000_000);
    expect(first).not.toBe(second);
    // 同一时间戳下靠序号区分，可直接读出顺序
    expect(first.endsWith('-1')).toBe(true);
    expect(second.endsWith('-2')).toBe(true);

    resetUploadSeq();
    expect(nextUploadId(1_700_000_000_000).endsWith('-1')).toBe(true);
  });

  it('storedPath 带变体，便于面板与日志区分场景', () => {
    resetUploadSeq();
    const result = buildUploadResult('avatar', '2026-10-09 10:00:00', 'fixed-id');
    expect(result.storedPath).toBe('/uploads/avatar/fixed-id');
    expect(result.fileId).toBe('fixed-id');
  });

  it('预览图用 encodeURIComponent，中文标签不乱码且不含裸 # 号', () => {
    const url = previewDataUrl('seed', '头像');
    expect(url).toContain('%E5%A4%B4%E5%83%8F');
    // `#` 在 data URL 里会被当成 fragment，必须被编码掉
    expect(url.slice('data:image/svg+xml;charset=utf-8,'.length)).not.toContain('#');
  });

  it('标签里的 SVG/XML 特殊字符被剥离，不给出注入面', () => {
    const url = previewDataUrl('seed', '</text><script>alert(1)</script>');
    const decoded = decodeURIComponent(url);
    expect(decoded).not.toContain('<script>');
    expect(decoded.match(/<text/g)).toHaveLength(2);
  });

  it('配色按种子稳定取值，同变体每次颜色一致', () => {
    const seed = 'drag-sort:abc';
    const [from, to] = pickPalette(seed);
    expect(pickPalette(seed)).toEqual([from, to]);
    expect([from, to]).toHaveLength(2);
    expect(from).toMatch(/^#[\da-f]{6}$/i);
    expect(to).toMatch(/^#[\da-f]{6}$/i);
  });

  it('hashCode 对空串与非数字输入都返回合法下标', () => {
    expect(hashCode('')).toBe(0);
    expect(hashCode('普通中文')).toBeGreaterThan(0);
    // 越界会返回 undefined，配色就变成 stop-color="undefined"
    for (const seed of ['', 'a', 'ab', '上传', 'x'.repeat(64)]) {
      const [color] = pickPalette(seed);
      expect(color).toMatch(/^#[\da-f]{6}$/i);
    }
  });
});
