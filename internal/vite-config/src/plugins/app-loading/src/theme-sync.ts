import type { AppLoadingOptions } from './types';

type ResolvedOptions = Required<AppLoadingOptions>;

export const THEME_SYNC_MARKER = 'data-app-loading-theme-sync';

/**
 * 生成注入 `<head>` 的首屏主题脚本。
 *
 * 为什么必须是脚本而不是构建期常量：插件的 `autoTheme` 在 `configResolved` 时扫一次
 * CSS，那份颜色属于"打包那一刻"的默认主题；用户在偏好面板里换了主色、切了深色，
 * 磁盘上的产物颜色不会跟着变，于是 loading 遮罩永远是出厂色。
 * vben 系的做法同样是在首屏读缓存回填，所以这里让插件吐一段**自包含**的 ES5 内联脚本：
 * 它跑在应用 bundle 之前，唯一的输入是偏好包写下的 `*_bootTheme` 快照。
 *
 * 脚本只写三类东西，且都与 `@antdv/preferences` 的 `applyPreferencesToDom` 同形：
 * `dark` class、`data-theme`、`custom` 档的 `--primary`。这三条应用启动后会原样
 * 再写一遍（值也来自同一份偏好），所以提前写不会留下"应用改不掉"的脏行内样式。
 * `--loading-*` 三条则只有 loading 模板读取，遮罩移除即随之消失，同样不构成污染。
 *
 * 快照里的颜色一律是 **HSL 通道串**（`215 100% 54%`）—— token 换成 shadcn 规范名
 * 之后 `<html>` 上读到的就是这个形状，脚本原样搬运、模板负责套 `hsl()`。
 * `version` 不是 2 就整块跳过颜色：v1 存的是完整颜色，`hsl(#1677ff)` 解析失败会
 * 让遮罩变成透明，比"首屏用兜底色"更糟。
 */
export function generateThemeSyncScript(options: ResolvedOptions): string {
  const { darkClass, themeCacheKeySuffix } = options;

  // 变量名与快照字段名一一对应，模板侧的消费见 defaults/loading.html
  const varMap = JSON.stringify({
    background: '--loading-background',
    foreground: '--loading-foreground',
    primary: '--loading-primary',
  });

  return `(function(){
try{
var SUFFIX=${JSON.stringify(`_${themeCacheKeySuffix}`)};
var DARK=${JSON.stringify(darkClass)};
/* 与 @antdv/shared/constants 的 THEME_DATA_ATTRIBUTE / CSS_VAR_PRIMARY 同源 */
var ATTR="data-theme";
var PV="--primary";
var VM=${varMap};
var raw=null,key,i;
/* 前缀由应用决定（configureSharedEnv 的 cachePrefix），读侧不该重复推导，按后缀找 */
for(i=0;i<localStorage.length;i++){
  key=localStorage.key(i);
  if(key&&key.slice(-SUFFIX.length)===SUFFIX){raw=localStorage.getItem(key);if(raw)break;}
}
if(!raw)return;
var s=JSON.parse(raw);
var root=document.documentElement;
var dark=s.theme==='dark'||(s.theme==='auto'&&!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches));
root.classList.toggle(DARK,dark);
root.style.colorScheme=dark?'dark':'light';
if(s.themeKey)root.setAttribute(ATTR,s.themeKey);
/* 颜色只在快照格式对得上时才搬：明暗/档位那几条与格式无关，照旧复原 */
var ok=s.version===2;
var v=s.vars||{};
/* 只有 custom 档内联主色：预设档在暗色下另有提亮的一版，压成亮色值就看不清了 */
if(ok&&s.themeKey==='custom'&&v.primary)root.style.setProperty(PV,v.primary);
if(ok&&s.mode===(dark?'dark':'light')){
  for(var name in VM){if(v[name])root.style.setProperty(VM[name],v[name]);}
}
var f=[];
if(s.colorWeak)f.push('invert(80%) grayscale(100%)');
if(s.grayMode)f.push('grayscale(100%)');
if(f.length)root.style.filter=f.join(' ');
}catch(e){}
})();`;
}

export function themeSyncTag(options: ResolvedOptions): string {
  return `<script ${THEME_SYNC_MARKER}>${generateThemeSyncScript(options)}</script>`;
}
