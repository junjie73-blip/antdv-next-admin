包管理器使用`pnpm`，框架：`Vue 3`+`TypeScript`+`Antdv Next` + `Tailwindcss`
禁止在标签上编写`Tailwindcss`类名，而是使用`cn`,需要从`@/utils/cn`中导入，动态生成类名。禁止将`cn`函数的参数写在模板中，例如：`<div :class="cn('bg-red-500', 'text-white')">`。而是在script setup中定义类名变量，例如：`const className = cn('bg-red-500', 'text-white')`，然后在模板中使用该变量，例如：`<div :class="className">`。
禁止使用`less`,`scss`等预处理器，仅使用`Tailwindcss`。
导入新的依赖，需要执行`pnpm add 依赖名`。
dom 需要使用  `useTemplateRef` 来获取 dom 元素，禁止直接使用 `document.querySelector` 等方法。
该项目配置了自动导入，禁止在此导入组件，例如：`import { NDropdownOption } from 'naive-ui'`。而是在模版中使用组件，例如：`<n-dropdown>`。
存入缓存一律使用`localStorageCacheStorage`,从`@/utils/cache`中导入。禁止直接使用`localStorage`。
弹窗和抽屉禁止使用antdv-next的`Drawer`和`Modal`组件，而是使用本项目的`Drawer`和`Modal`组件。地址：`@/components/Modal`和`@/components/Drawer`。
判断类型不能通过自带的`typeof`等方法，而是使用`es-toolkit`提供的方法，例如：`isObject`、`isArray`等。
尽量使用第三方库提供的方法，例如：`@vueuse/core`、`es-toolkit`、`dayjs`等。
vue文件中可以编写`tsx` 语法，只需要将`script`中的代码写在`render`函数中即可。
编写`tsx`组件，需要视情况而定，看是否是使用`vue`文件还是`tsx`文件。如果是简单的组件，例如：只包含模板和脚本，那么可以使用`vue文件`。如果是复杂的组件，例如：包含多个子组件，那么可以使用`tsx`文件。
父子组件双向通信尽量采用`defineModel`,而不是`prop`+`emit` 组合方式实现。