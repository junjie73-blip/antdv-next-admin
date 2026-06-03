# MarkdownEditor 编辑器组件

基于 [WangEditor](https://www.wangeditor.com/) 封装的富文本编辑器组件，支持工具栏配置、实时渲染、图片上传和字数统计。

## 基础用法

```vue
<script setup lang="ts">
import { MarkdownEditor } from '@/components/business/MarkdownEditor'
import { ref } from 'vue'

const content = ref('')

function handleChange(value: string, html: string) {
  console.log('内容变化:', value)
  console.log('HTML:', html)
}
</script>

<template>
  <MarkdownEditor
    v-model="content"
    :height="400"
    placeholder="请输入内容..."
    @change="handleChange"
  />
</template>
```

## 组件 Props

### 基础属性

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `modelValue` | 编辑器内容（v-model） | `string` | `''` |
| `height` | 编辑器高度 | `string \| number` | `'500px'` |
| `mode` | 编辑器模式 | `'edit' \| 'preview' \| 'split'` | `'edit'` |
| `theme` | 主题风格 | `'light' \| 'dark'` | `'light'` |
| `placeholder` | 占位文本 | `string` | `'请输入内容...'` |
| `readonly` | 是否只读 | `boolean` | `false` |
| `disabled` | 是否禁用 | `boolean` | `false` |

### 功能控制

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `showToolbar` | 是否显示工具栏 | `boolean` | `true` |
| `autoFocus` | 是否自动聚焦 | `boolean` | `false` |
| `maxLength` | 最大字数限制 | `number` | - |
| `showCount` | 是否显示字数统计 | `boolean` | `true` |

### 配置项

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `toolbarConfig` | 工具栏配置 | `Partial<IToolbarConfig>` | - |
| `editorConfig` | 编辑器配置 | `Partial<IEditorConfig>` | - |
| `imageUpload` | 图片上传配置 | `ImageUploadConfig` | - |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `update:modelValue` | 内容变化（v-model） | `(value: string) => void` |
| `change` | 内容变化详情 | `(value: string, html: string) => void` |
| `focus` | 获得焦点 | `(editor: IDomEditor) => void` |
| `blur` | 失去焦点 | `(editor: IDomEditor) => void` |
| `uploadSuccess` | 图片上传成功 | `(file: File, response: any) => void` |
| `uploadError` | 图片上传失败 | `(file: File, error: any) => void` |
| `maxLength` | 超过字数限制 | `(currentLength, maxLength) => void` |

## 组件实例方法

通过 ref 调用：

```ts
const editorRef = ref<MarkdownEditorInstance>()

// 获取编辑器实例
const editor = editorRef.value?.getEditor()

// 获取/设置内容
editorRef.value?.getHtml()
editorRef.value?.setHtml('<p>新内容</p>')

// 操作
editorRef.value?.focus()
editorRef.value?.clear()
```

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `getEditor` | 获取 WangEditor 实例 | `IDomEditor \| null` |
| `getHtml` | 获取 HTML 内容 | `string` |
| `getText` | 获取纯文本内容 | `string` |
| `setHtml` | 设置 HTML 内容 | `(html: string) => void` |
| `setMarkdown` | 设置 Markdown 内容 | `(markdown: string) => void` |
| `clear` | 清空内容 | `void` |
| `focus` | 聚焦编辑器 | `void` |
| `blur` | 失焦编辑器 | `void` |
| `undo` | 撤销 | `void` |
| `redo` | 重做 | `void` |
| `insertText` | 插入文本 | `(text: string) => void` |
| `insertHtml` | 插入 HTML | `(html: string) => void` |
| `selectAll` | 全选 | `void` |
| `getStats` | 获取字数统计 | `{ textLength, htmlLength }` |

## 工具栏配置

### 默认工具栏

内置默认工具栏包含以下功能按钮：

```
标题选择 | 加粗 斜体 下划线 删除线 文字颜色 背景颜色 |
字号 字体 行高 |
无序列表 有序列表 待办 对齐方式 |
插入链接 上传图片 插入视频 插入表格 代码块 |
撤销 重做 | 全屏
```

### 自定义工具栏

通过 `toolbarConfig` 自定义工具栏按钮：

```vue
<script setup lang="ts">
import { MarkdownEditor } from '@/components/business/MarkdownEditor'

const toolbarConfig = {
  // 仅显示需要的按钮
  toolbarKeys: [
    'headerSelect',
    '|',
    'bold',
    'italic',
    'underline',
    '|',
    'bulletedList',
    'numberedList',
    '|',
    'insertLink',
    'uploadImage',
    '|',
    'undo',
    'redo',
  ],
}
</script>

<template>
  <MarkdownEditor v-model="content" :toolbar-config="toolbarConfig" />
</template>
```

## 编辑器模式

### edit 模式（默认）

完整编辑模式，显示工具栏和编辑区域：

```vue
<MarkdownEditor v-model="content" mode="edit" />
```

### preview 模式

纯预览模式，隐藏工具栏：

```vue
<MarkdownEditor v-model="content" mode="preview" />
```

### split 模式

分栏模式，左侧编辑、右侧预览：

```vue
<MarkdownEditor v-model="content" mode="split" :height="600" />
```

## 图片上传配置

### 配置接口说明

```ts
interface ImageUploadConfig {
  server: string              // 上传服务地址（必填）
  fieldName?: string          // 上传字段名，默认 'file'
  headers?: Record<string, string>   // 自定义请求头
  meta?: Record<string, string>      // 额外上传参数
  maxFileSize?: number         // 最大文件大小（MB），默认 5
  allowedFileTypes?: string[]  // 允许的文件类型
  customUpload?: (file: File, insertFn: (url, alt?, href?) => void) => void  // 自定义上传方法
}
```

### 服务端上传示例

```vue
<script setup lang="ts">
const imageUpload = {
  server: '/api/upload/image',
  fieldName: 'file',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  meta: {
    type: 'article',
  },
  maxFileSize: 10,
  allowedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
}
</script>

<template>
  <MarkdownEditor v-model="content" :image-upload="imageUpload" />
</template>
```

### 自定义上传方法

对接 OSS 或其他存储服务时使用：

```vue
<script setup lang="ts">
import { ossUpload } from '@/utils/upload'

const imageUpload = {
  customUpload(file: File, insertFn: (url: string) => void) {
    // 使用自定义上传逻辑
    ossUpload(file).then((result) => {
      // 将 URL 插入到编辑器中
      insertFn(result.url)
    })
  },
}
</script>

<template>
  <MarkdownEditor v-model="content" :image-upload="imageUpload" />
</template>
```

## 字数统计与限制

### 显示字数统计

底部自动显示当前字数：

```vue
<MarkdownEditor v-model="content" :show-count="true" />
<!-- 输出：256 字 -->
```

### 设置最大字数限制

```vue
<MarkdownEditor
  v-model="content"
  :max-length="5000"
  @max-length="(current, max) => message.warning(`已超过最大字数 ${max}`)"
/>
<!-- 输出：3200 / 5000 字上限 -->
```

## 主题切换

### 亮色主题（默认）

```vue
<MarkdownEditor v-model="content" theme="light" />
```

### 暗色主题

```vue
<MarkdownEditor v-model="content" theme="dark" />
```

暗色主题会修改工具栏和编辑区域的背景色，适配深色 UI 场景。

## 典型使用场景

### 文章编辑页面

```vue
<script setup lang="ts">
import { MarkdownEditor } from '@/components/business/MarkdownEditor'
import { ref } from 'vue'

const content = ref('')
const editorRef = ref<MarkdownEditorInstance>()

async function handleSubmit() {
  const html = editorRef.value?.getHtml() || ''
  await api.saveArticle({ content: html })
  message.success('保存成功')
}

async function handlePreview() {
  const html = editorRef.value?.getHtml() || ''
  // 打开预览弹窗...
}
</script>

<template>
  <div class="space-y-4">
    <!-- 标题输入 -->
    <a-input placeholder="文章标题" size="large" />

    <!-- 编辑器 -->
    <MarkdownEditor
      ref="editorRef"
      v-model="content"
      :height="600"
      :image-upload="imageUploadConfig"
      :max-length="10000"
    />

    <!-- 操作按钮 -->
    <div class="flex justify-end gap-3">
      <a-button @click="handlePreview">预览</a-button>
      <a-button type="primary" @click="handleSubmit">发布</a-button>
    </div>
  </div>
</template>
```
