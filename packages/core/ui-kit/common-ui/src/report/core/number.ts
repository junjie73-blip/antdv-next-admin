/**
 * 单元格值 → 数值的唯一解释口径。
 *
 * 分层位置：`core/` 最底层的叶子模块，谁都可以依赖它，它谁都不依赖。
 * 之所以单独成文件：`aggregate`（求和/均值/中位数/排序）与 `format`（格式化）必须用同一套
 * "这个单元格算不算一个数"的判定，否则会出现"格式化成 `—` 的值参与了求和"这类对不上账的 bug；
 * 但让 `format` 反过来 import `aggregate` 会把整个聚合引擎拖进组件的依赖图，所以两边都指向这里。
 *
 * 不做的事：不做本地化数字解析（`1.234,56` 这种欧式写法一律当脏数据），不做单位换算。
 */

/** 常见货币符号（含全角 ￥）；只认首尾各一个，中间出现的当脏数据拒绝 */
const CURRENCY_CHARS = '\u00A5\uFFE5$\u20AC\u00A3\u20A9';

/** 剥掉货币符号之后的纯数字文本：可带正负号、小数、科学计数 */
const PURE_NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

function isCurrencyChar(char: string): boolean {
  return char !== '' && CURRENCY_CHARS.includes(char);
}

/**
 * 剥掉首尾的货币符号，把正负号留在数字上。
 * `-¥1,234` 与 `¥-1,234` 两种写法都要认：前者是 `format.ts` 的输出格式，后者是手工录入的习惯。
 * 中间的符号（`1¥2`）不处理，免得把两段数字拼成一个看起来很像回事的错误值。
 */
function stripCurrency(text: string): null | string {
  let body = text;
  let sign = '';
  if (body.startsWith('-') || body.startsWith('+')) {
    sign = body.slice(0, 1);
    body = body.slice(1);
  }
  if (isCurrencyChar(body.slice(0, 1))) body = body.slice(1);
  if (!sign && (body.startsWith('-') || body.startsWith('+'))) {
    sign = body.slice(0, 1);
    body = body.slice(1);
  }
  if (isCurrencyChar(body.slice(-1))) body = body.slice(0, -1);
  const numeric = `${sign}${body}`;
  return PURE_NUMBER_RE.test(numeric) ? numeric : null;
}

/**
 * 把任意单元格值解释成数值；不可解释时返回 `null`。
 *
 * 判定顺序：
 * 1. `number` 且有限 → 直接用（`NaN` / `Infinity` 返回 `null`，它们不是业务事实）；
 * 2. 非字符串（boolean / Date / 对象）→ `null`：把 `true` 当 1、把日期当 epoch 毫秒加进金额是典型的静默错误；
 * 3. 字符串 → 去空白与千分位（空格、`,`、`_`），认货币符号与 `%` 后缀（`'12%'` 当 0.12，
 *    接口直接下发百分比字符串太常见），其余非纯数字形式（`'-'`、`'N/A'`、`'待定'`）全部返回 `null`。
 */
export function toNumberValue(value: unknown): null | number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const compact = value.trim().replaceAll(/[\s,_]/gu, '');
  if (compact === '') return null;
  const percent = compact.endsWith('%');
  const numeric = stripCurrency(percent ? compact.slice(0, -1) : compact);
  if (numeric === null) return null;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return percent ? parsed / 100 : parsed;
}

/**
 * 单元格是否"没填"。`null` / `undefined` / 空串三者在报表里语义相同，
 * `count`、`first`、`last` 以及排序时的空值置后都用它判定；
 * 注意 `0` 和 `false` 不算空 —— 它们是真实的数据。
 */
export function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}
