import type { AttachmentInput } from '../../src/im/index';

import { describe, expect, it } from 'vitest';

import {
  formatFileSize,
  isAcceptable,
  normalizeAttachment,
  resolvePreviewUrl,
  validateAttachment,
  validateAttachments,
} from '../../src/im/index';

/**
 * 测试口径：附件这一层只有两件事容易出错 —— **边界**与**越权**。
 *
 * 边界是「2MB 到底能不能传」：按 1024 还是 1000 算，界面上写的上限和实际能不能传必须一致，
 * 否则用户会对着一个"明明没超却报错"的文件反复重试。
 * 越权是「本包不许自己造 blob URL」：预览地址只能由宿主注入的工厂生成，
 * 因为 revoke 的时机只有握住 File 的人知道 —— 这条也被写成断言，防止有人图省事改回内部实现。
 */

describe('归一化', () => {
  it('去掉路径与首尾空白，只留展示名：浏览器把整条路径塞进 name 时界面会显示一长串', () => {
    expect(
      normalizeAttachment({ name: '/private/tmp/  季度报告.pdf  ', size: 10 })
        .name,
    ).toBe('季度报告.pdf');
    expect(
      normalizeAttachment({ name: 'C:\\Users\\me\\下载\\a.docx', size: 10 })
        .name,
    ).toBe('a.docx');
  });

  it('空文件名给占位名：附件卡片不能渲染成一条没有字的空行', () => {
    expect(normalizeAttachment({ name: '   ', size: 1 }).name).toBe(
      '未命名文件',
    );
    expect(normalizeAttachment({ name: 'a/', size: 1 }).name).toBe(
      '未命名文件',
    );
  });

  it('体积取整并把负数与 NaN 归零：NaN 会一路渲染成 "NaN B" 出现在消息里', () => {
    expect(normalizeAttachment({ name: 'a', size: 1024.7 }).size).toBe(1025);
    expect(normalizeAttachment({ name: 'a', size: -5 }).size).toBe(0);
    expect(normalizeAttachment({ name: 'a', size: Number.NaN }).size).toBe(0);
    expect(
      normalizeAttachment({ name: 'a', size: Number.POSITIVE_INFINITY }).size,
    ).toBe(0);
  });

  it('mIME 小写化；空白与空串视为"没有 MIME"而不是空字段：字段在但为空会让类型判断走偏', () => {
    expect(
      normalizeAttachment({ name: 'a', size: 1, type: '  Image/PNG ' }).type,
    ).toBe('image/png');
    expect(
      normalizeAttachment({ name: 'a', size: 1, type: '   ' }),
    ).not.toHaveProperty('type');
    expect(normalizeAttachment({ name: 'a', size: 1 })).not.toHaveProperty(
      'type',
    );
  });

  it('url 同样去空白，空串不写进字段：空 url 会被当成"有地址"，预览区于是点不开', () => {
    expect(
      normalizeAttachment({ name: 'a', size: 1, url: ' https://x.invalid/a ' })
        .url,
    ).toBe('https://x.invalid/a');
    expect(
      normalizeAttachment({ name: 'a', size: 1, url: '  ' }),
    ).not.toHaveProperty('url');
  });
});

describe('准入校验的边界', () => {
  it('体积上限按十进制 MB 算，正好等于上限放行：按 1024 算会让界面写的 2MB 变成实际能传 2.09MB', () => {
    const atLimit = validateAttachment(
      { name: 'a.pdf', size: 2_000_000 },
      { maxSizeMb: 2 },
    );
    expect(atLimit.ok).toBe(true);
    expect(atLimit.error).toBeUndefined();
    const overLimit = validateAttachment(
      { name: 'a.pdf', size: 2_000_001 },
      { maxSizeMb: 2 },
    );
    expect(overLimit.ok).toBe(false);
    expect(overLimit.error).toContain('超过 2MB 上限');
    expect(overLimit.error).toContain('a.pdf');
  });

  it('不传上限或上限为 0 表示不限体积：0 不该被当成"一个字节都不许传"', () => {
    const huge = { name: 'a.zip', size: 5_000_000_000 };
    expect(validateAttachment(huge).ok).toBe(true);
    expect(validateAttachment(huge, { maxSizeMb: 0 }).ok).toBe(true);
  });

  it('超限优先于类型不符：先报最硬的那个失败，否则传了个 2GB 才发现后缀不许', () => {
    const result = validateAttachment(
      { name: 'tool.exe', size: 3_000_000 },
      { accept: ['.png'], maxSizeMb: 1 },
    );
    expect(result.error).toContain('超过 1MB 上限');
    expect(result.error).not.toContain('不在允许的类型里');
  });

  it('白名单支持扩展名、image/* 与完整 MIME 三种写法混着来：宿主的 accept 就是从各处抄来的', () => {
    const accept = ['.pdf', 'image/*', 'application/zip'];
    for (const input of [
      { name: 'a.pdf', size: 1 },
      { name: 'b.PNG', size: 1 },
      { name: 'c.zip', size: 1, type: 'application/zip' },
    ]) {
      expect(
        validateAttachment(input, { accept }).ok,
        JSON.stringify(input),
      ).toBe(true);
    }
    expect(validateAttachment({ name: 'd.txt', size: 1 }, { accept }).ok).toBe(
      false,
    );
  });

  it('宿主没给 MIME 时按扩展名推断：部分系统里 File.type 就是空的，只认 MIME 会全拒', () => {
    expect(isAcceptable({ name: 'photo.jpg', size: 1 }, ['image/*'])).toBe(
      true,
    );
    expect(isAcceptable({ name: 'archive.zip', size: 1 }, ['image/*'])).toBe(
      false,
    );
    // 认不出来的扩展名不猜类型，只按字面匹配
    expect(
      isAcceptable({ name: 'data.unknownext', size: 1 }, ['image/*']),
    ).toBe(false);
    // 没有扩展名的文件不该被扩展名白名单命中：猜一个出来就是替用户做决定
    expect(isAcceptable({ name: 'README', size: 1 }, ['.md'])).toBe(false);
  });

  it('空 accept 表示不限类型而不是全拒：与浏览器 accept="" 的语义必须一致', () => {
    expect(isAcceptable({ name: 'x.exe', size: 1 }, [])).toBe(true);
    expect(isAcceptable({ name: 'x.exe', size: 1 }, undefined)).toBe(true);
    expect(isAcceptable({ name: 'x.exe', size: 1 }, ['*', '*/*'])).toBe(true);
    // 带空格的项（宿主从输入框里抄来的）也要能命中
    expect(
      isAcceptable({ name: 'a.png', size: 1, type: 'image/png' }, [' .PNG ']),
    ).toBe(true);
  });

  it('校验返回的附件对象是归一化过的：宿主直接拿原始 File 名字去渲染就会漏出路径', () => {
    const result = validateAttachment(
      { name: 'C:\\tmp\\发票.PDF', size: 1_500_000, type: 'application/pdf' },
      { accept: ['.pdf'], maxSizeMb: 2 },
    );
    expect(result.attachment).toStrictEqual({
      name: '发票.PDF',
      size: 1_500_000,
      type: 'application/pdf',
    });
  });

  it('原始 source 原样带回来，本包不读它一个方法：读了就等于依赖浏览器 File API，SSR 与单测都要打折', () => {
    const source = { marker: '宿主自己的 File 对象' };
    const result = validateAttachment(
      { name: 'a.png', size: 1, source },
      { accept: ['.png'] },
    );
    expect(result.source).toBe(source);
    expect(result.attachment).not.toHaveProperty('source');
  });

  it('批量校验把通过与拒绝分开列，每条拒绝各自带原因：一次拖 20 个文件要能指出是哪几个没过', () => {
    const inputs: AttachmentInput[] = [
      { name: 'a.png', size: 1000 },
      { name: 'b.txt', size: 1000 },
      { name: 'c.png', size: 99_000_000 },
    ];
    const { accepted, rejected } = validateAttachments(inputs, {
      accept: ['.png'],
      maxSizeMb: 1,
    });
    expect(accepted.map((item) => item.attachment.name)).toStrictEqual([
      'a.png',
    ]);
    expect(rejected.map((item) => item.attachment.name)).toStrictEqual([
      'b.txt',
      'c.png',
    ]);
    expect(rejected[0]?.error).toContain('不在允许的类型里');
    expect(rejected[1]?.error).toContain('超过 1MB 上限');
  });
});

describe('预览地址的口径', () => {
  const source = { size: 1, type: 'image/png' };

  it('有稳定 url 就用 url，哪怕宿主也注入了工厂：签名地址不该被本地 blob 覆盖掉', () => {
    const createObjectUrl = () => 'blob:/should-not-be-used';
    expect(
      resolvePreviewUrl(
        { name: 'a.png', size: 1, url: 'https://cdn.invalid/a.png' },
        { createObjectUrl, source },
      ),
    ).toBe('https://cdn.invalid/a.png');
  });

  it('没 url、宿主也没注入工厂时返回 undefined，界面退回渲染文件名：本包自己造 blob URL 就是稳定泄漏', () => {
    expect(resolvePreviewUrl({ name: 'a.png', size: 1 })).toBeUndefined();
    expect(
      resolvePreviewUrl({ name: 'a.png', size: 1 }, { source }),
    ).toBeUndefined();
    expect(
      resolvePreviewUrl(
        { name: 'a.png', size: 1 },
        { createObjectUrl: () => 'blob:/x' },
      ),
    ).toBeUndefined();
  });

  it('只有同时给了工厂与 source 才生成，并且把 source 原样交给工厂：生命周期只有握住 File 的宿主知道', () => {
    const seen: unknown[] = [];
    const url = resolvePreviewUrl(
      { name: 'a.png', size: 1 },
      {
        createObjectUrl: (value) => {
          seen.push(value);
          return 'blob:/from-host';
        },
        source,
      },
    );
    expect(url).toBe('blob:/from-host');
    // 传进去的必须是宿主给的那个对象本身，而不是本包复制出来的附件
    expect(seen).toStrictEqual([source]);
  });
});

describe('人读体积', () => {
  it('1000 进制分档、尾部 .0 不写：显示 "1.0 MB" 与 "0.0 KB" 都看着像坏了', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-5)).toBe('0 B');
    expect(formatFileSize(999)).toBe('999 B');
    expect(formatFileSize(1000)).toBe('1 KB');
    expect(formatFileSize(1500)).toBe('1.5 KB');
    expect(formatFileSize(1_000_000)).toBe('1 MB');
    expect(formatFileSize(1_234_567)).toBe('1.2 MB');
    expect(formatFileSize(1_000_000_000)).toBe('1 GB');
    expect(formatFileSize(1_500_000_000)).toBe('1.5 GB');
  });
});
