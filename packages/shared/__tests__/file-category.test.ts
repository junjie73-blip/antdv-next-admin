import { describe, expect, it } from 'vitest';

import { getExt, getFileCategory } from '../src/file-category';

describe('getExt', () => {
  it('取小写后缀，不含点则返回空串', () => {
    expect(getExt('report.PDF')).toBe('.pdf');
    expect(getExt('archive.tar.gz')).toBe('.gz');
    expect(getExt('Makefile')).toBe('');
    expect(getExt('README.')).toBe('');
    expect(getExt('')).toBe('');
  });

  it('隐藏文件 .gitignore 的后缀按 .gitignore 处理', () => {
    expect(getExt('.gitignore')).toBe('.gitignore');
  });
});

describe('getFileCategory', () => {
  it('常见办公与媒体格式分类正确', () => {
    expect(getFileCategory('a.png')).toBe('image');
    expect(getFileCategory('a.xlsx')).toBe('excel');
    expect(getFileCategory('a.docx')).toBe('word');
    expect(getFileCategory('a.pptx')).toBe('pptx');
    expect(getFileCategory('a.pdf')).toBe('pdf');
    expect(getFileCategory('a.mp4')).toBe('video');
    expect(getFileCategory('a.zip')).toBe('archive');
    expect(getFileCategory('a.md')).toBe('markdown');
  });

  it('未知后缀与无后缀都归入 other，不该抛错', () => {
    expect(getFileCategory('a.xyz')).toBe('other');
    expect(getFileCategory('LICENSE')).toBe('other');
    expect(getFileCategory('')).toBe('other');
  });
});
