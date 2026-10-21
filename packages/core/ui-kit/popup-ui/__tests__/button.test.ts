import { resolvePopupButton } from '../src/shared/button';

describe('resolvePopupButton', () => {
  it('antdv type → shadcn variant 映射', () => {
    expect(resolvePopupButton({ type: 'primary' }).variant).toBe('default');
    expect(resolvePopupButton({ type: 'danger' }).variant).toBe('destructive');
    expect(resolvePopupButton({ type: 'dashed' }).variant).toBe('outline');
    expect(resolvePopupButton({ type: 'default' }).variant).toBe('outline');
    expect(resolvePopupButton({ type: 'ghost' }).variant).toBe('ghost');
    expect(resolvePopupButton({ type: 'link' } as any).variant).toBe('link');
    expect(resolvePopupButton({ type: 'text' } as any).variant).toBe('ghost');
  });

  it('无 type 时使用 fallbackType', () => {
    expect(resolvePopupButton(undefined, 'primary').variant).toBe('default');
    expect(resolvePopupButton({}, 'danger').variant).toBe('destructive');
    expect(resolvePopupButton({}, undefined).variant).toBe('outline');
  });

  it('显式 variant 优先于 type 映射', () => {
    expect(
      resolvePopupButton({ type: 'primary', variant: 'secondary' }).variant,
    ).toBe('secondary');
  });

  it('loading 合并自身与外部（okLoading）', () => {
    expect(resolvePopupButton({ loading: true }).loading).toBe(true);
    expect(resolvePopupButton(undefined, 'primary', true).loading).toBe(true);
    expect(
      resolvePopupButton({ loading: false }, 'primary', false).loading,
    ).toBe(false);
  });

  it('其余属性原样透传', () => {
    const resolved = resolvePopupButton(
      { disabled: true, size: 'small', class: 'x' },
      'primary',
    );
    expect(resolved.disabled).toBe(true);
    expect(resolved.size).toBe('small');
    expect(resolved.class).toBe('x');
  });
});
