<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/cn'

// ==================== 类型定义 ====================
interface TreeNode {
  key: string
  title: string
  icon?: string
  children?: TreeNode[]
  isLeaf?: boolean
}

// ==================== 样式定义 ====================
const containerClassName = cn('space-y-6')

const infoBoxClassName = cn(
  'mb-4 p-3 rounded-lg text-sm',
)

const blueInfoClassName = cn(
  ...infoBoxClassName.split(' '),
  'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
)

const yellowInfoClassName = cn(
  ...infoBoxClassName.split(' '),
  'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
)

const greenInfoClassName = cn(
  ...infoBoxClassName.split(' '),
  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
)

const purpleInfoClassName = cn(
  ...infoBoxClassName.split(' '),
  'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
)

const virtualScrollContainerClassName = cn(
  'mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden',
)

// 操作按钮相关样式
const actionNodeClassName = cn(
  'flex items-center justify-between group w-full pr-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-1 -mx-1',
)

const actionButtonsClassName = cn(
  'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
)

// ==================== 1. 基础用法 - 文件目录结构 ====================
const basicTreeData = ref<TreeNode[]>([
  {
    key: 'root',
    title: '根目录',
    children: [
      {
        key: 'src',
        title: 'src',
        children: [
          { key: 'components', title: 'components' },
          { key: 'views', title: 'views' },
          { key: 'utils', title: 'utils' },
          {
            key: 'assets',
            title: 'assets',
            children: [
              { key: 'images', title: 'images' },
              { key: 'styles', title: 'styles' },
            ],
          },
        ],
      },
      {
        key: 'public',
        title: 'public',
        children: [{ key: 'favicon.ico', title: 'favicon.ico' }],
      },
      { key: 'package.json', title: 'package.json' },
      { key: 'vite.config.ts', title: 'vite.config.ts' },
    ],
  },
])

// ==================== 2. 可勾选的树 ====================
const checkableTreeData = ref<TreeNode[]>([
  {
    key: 'dept-1',
    title: '技术部',
    children: [
      {
        key: 'dept-1-1',
        title: '前端组',
        children: [
          { key: 'user-1', title: '张三' },
          { key: 'user-2', title: '李四' },
          { key: 'user-3', title: '王五' },
        ],
      },
      {
        key: 'dept-1-2',
        title: '后端组',
        children: [
          { key: 'user-4', title: '赵六' },
          { key: 'user-5', title: '孙七' },
        ],
      },
    ],
  },
  {
    key: 'dept-2',
    title: '产品部',
    children: [
      { key: 'user-6', title: '周八' },
      { key: 'user-7', title: '吴九' },
    ],
  },
])

const checkedKeys = ref<string[]>([])
const halfCheckedKeys = ref<string[]>([])

function handleCheck(keys: string[] | { checked: string[], halfChecked: string[] }) {
  if (Array.isArray(keys)) {
    checkedKeys.value = keys
  }
  else {
    checkedKeys.value = keys.checked
    halfCheckedKeys.value = keys.halfChecked
  }
}

// ==================== 3. 搜索过滤树 ====================
const searchValue = ref('')
const searchableTreeData = ref<TreeNode[]>([
  {
    key: 'search-1',
    title: '北京分公司',
    children: [
      {
        key: 'search-1-1',
        title: '海淀研发中心',
        children: [
          { key: 'search-1-1-1', title: '前端开发部' },
          { key: 'search-1-1-2', title: '后端开发部' },
          { key: 'search-1-1-3', title: '测试组' },
        ],
      },
      {
        key: 'search-1-2',
        title: '朝阳市场部',
        children: [
          { key: 'search-1-2-1', title: '市场推广组' },
          { key: 'search-1-2-2', title: '品牌策划组' },
        ],
      },
    ],
  },
  {
    key: 'search-2',
    title: '上海分公司',
    children: [
      { key: 'search-2-1', title: '浦东新区研发中心' },
      { key: 'search-2-2', title: '徐汇区运营中心' },
    ],
  },
  {
    key: 'search-3',
    title: '深圳分公司',
    children: [
      { key: 'search-3-1', title: '南山区创新中心' },
    ],
  },
])

// ==================== 4. 异步加载数据 ====================
const asyncTreeData = ref<TreeNode[]>([
  {
    key: 'async-1',
    title: '一级节点 1',
    isLeaf: false,
  },
  {
    key: 'async-2',
    title: '一级节点 2',
    isLeaf: false,
  },
  {
    key: 'async-3',
    title: '一级节点 3（叶子节点）',
    isLeaf: true,
  },
])

function findNode(nodes: TreeNode[], key: string): TreeNode | null {
  for (const node of nodes) {
    if (node.key === key)
      return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found)
        return found
    }
  }
  return null
}

async function onLoadData(treeNode: any) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const nodeKey = treeNode.dataRef.key
      const node = findNode(asyncTreeData.value, nodeKey)
      if (node && !node.children) {
        node.children = [
          { key: `${nodeKey}-1`, title: `子节点 ${nodeKey}-1`, isLeaf: true },
          { key: `${nodeKey}-2`, title: `子节点 ${nodeKey}-2`, isLeaf: false },
          { key: `${nodeKey}-3`, title: `子节点 ${nodeKey}-3（叶子）`, isLeaf: true },
        ]
        asyncTreeData.value = [...asyncTreeData.value]
      }
      resolve()
    }, 500)
  })
}

// ==================== 5. 拖拽排序树 ====================
const draggableTreeData = ref<TreeNode[]>([
  {
    key: 'drag-1',
    title: '任务列表',
    children: [
      { key: 'drag-1-1', title: '需求分析' },
      { key: 'drag-1-2', title: 'UI 设计' },
      { key: 'drag-1-3', title: '前端开发' },
      { key: 'drag-1-4', title: '后端开发' },
      { key: 'drag-1-5', title: '测试验收' },
      { key: 'drag-1-6', title: '部署上线' },
    ],
  },
])

function onDrop(info: any) {
  const dragKeys = info.dragNodesKeys || []
  const dropKey = info.node?.key

  // 构建新顺序提示信息
  const newOrder = draggableTreeData.value[0]?.children
    ?.map((item, index) => `${index + 1}. ${item.title}`)
    .join('\n') || ''

  message.info(`拖拽完成！\n\n拖拽节点: ${dragKeys.join(', ') || '未知'}\n目标位置: ${dropKey || '末尾'}\n\n新顺序:\n${newOrder}`)
}

function allowDrop(): boolean {
  return true
}

// ==================== 6. 带操作按钮的树 ====================
const actionTreeData = ref<TreeNode[]>([
  {
    key: 'action-1',
    title: '组织架构',
    children: [
      {
        key: 'action-1-1',
        title: '总经办',
        children: [
          { key: 'action-1-1-1', title: '总经理' },
          { key: 'action-1-1-2', title: '秘书' },
        ],
      },
      {
        key: 'action-1-2',
        title: '技术研发部',
        children: [
          { key: 'action-1-2-1', title: '前端组' },
          { key: 'action-1-2-2', title: '后端组' },
          { key: 'action-1-2-3', title: '测试组' },
        ],
      },
      {
        key: 'action-1-3',
        title: '市场营销',
        children: [
          { key: 'action-1-3-1', title: '推广组' },
          { key: 'action-1-3-2', title: '销售组' },
        ],
      },
    ],
  },
])

function handleAddChild(nodeKey: string) {
  message.info(`添加子节点到: ${nodeKey}`)
}

function handleEdit(nodeKey: string, title: string) {
  message.info(`编辑节点:\nKey: ${nodeKey}\nTitle: ${title}`)
}

function handleDelete(nodeKey: string) {
  message.warning(`删除节点: ${nodeKey}`)
}

// ==================== 7. 连接线样式树 ====================
const lineTreeData = ref<TreeNode[]>([
  {
    key: 'line-1',
    title: '公司总部',
    children: [
      {
        key: 'line-1-1',
        title: '华北区域',
        children: [
          { key: 'line-1-1-1', title: '北京分部' },
          { key: 'line-1-1-2', title: '天津分部' },
          { key: 'line-1-1-3', title: '河北分部' },
        ],
      },
      {
        key: 'line-1-2',
        title: '华东区域',
        children: [
          { key: 'line-1-2-1', title: '上海分部' },
          { key: 'line-1-2-2', title: '杭州分部' },
          { key: 'line-1-2-3', title: '南京分部' },
        ],
      },
      {
        key: 'line-1-3',
        title: '华南区域',
        children: [
          { key: 'line-1-3-1', title: '广州分部' },
          { key: 'line-1-3-2', title: '深圳分部' },
        ],
      },
    ],
  },
])

// ==================== 8. 虚拟滚动树（大数据量） ====================
const virtualExpandedKeys = ref<string[]>(['virtual-root'])

function generateLargeTreeData(): TreeNode[] {
  const data: TreeNode[] = []
  const rootNode: TreeNode = {
    key: 'virtual-root',
    title: '根节点（包含 1000+ 子节点）',
    children: [],
  }

  for (let i = 1; i <= 100; i++) {
    const groupNode: TreeNode = {
      key: `group-${i}`,
      title: `分组 ${i}`,
      children: [],
    }

    for (let j = 1; j <= 10; j++) {
      groupNode.children!.push({
        key: `node-${i}-${j}`,
        title: `节点 ${i}-${j}（第 ${(i - 1) * 10 + j} 个）`,
        isLeaf: true,
      })
    }

    rootNode.children!.push(groupNode)
  }

  data.push(rootNode)
  return data
}

const virtualTreeData = ref<TreeNode[]>(generateLargeTreeData())
</script>

<template>
  <div :class="containerClassName">
    <!-- 1. 基础用法 -->
    <a-card
      title="基础用法"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">展示文件目录结构</span>
      </template>
      <a-tree
        :tree-data="basicTreeData"
        :default-expanded-keys="['root',
                                 'src']"
        :show-icon="false"
      >
        <template #title="{ title }">
          <span class="text-gray-700 dark:text-gray-300">{{ title }}</span>
        </template>
      </a-tree>
    </a-card>

    <!-- 2. 可勾选的树 -->
    <a-card
      title="可勾选的树"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">Checkbox 多选模式</span>
      </template>
      <div :class="blueInfoClassName">
        <p class="mb-1">
          已选中: {{ checkedKeys.length }} 个节点
        </p>
        <p
          v-if="halfCheckedKeys.length > 0"
          class="text-xs opacity-80"
        >
          半选状态: {{ halfCheckedKeys.join(', ') }}
        </p>
        <p class="text-xs opacity-60 mt-1 break-all">
          Keys: [{{ checkedKeys.join(', ') || '无' }}]
        </p>
      </div>
      <a-tree
        :tree-data="checkableTreeData"
        checkable
        show-line
        :checked-keys="checkedKeys"
        :default-expanded-keys="['dept-1',
                                 'dept-1-1',
                                 'dept-1-2']"
        @check="handleCheck"
      >
        <template #title="{ title }">
          <span>{{ title }}</span>
        </template>
      </a-tree>
    </a-card>

    <!-- 3. 搜索过滤树 -->
    <a-card
      title="搜索过滤树"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">输入关键字过滤匹配节点</span>
      </template>
      <div class="mb-4">
        <a-input
          v-model:value="searchValue"
          placeholder="输入关键字搜索..."
          allow-clear
          style="max-width: 320px"
        />
      </div>
      <a-tree
        :tree-data="searchableTreeData"
        :default-expanded-keys="['search-1',
                                 'search-1-1',
                                 'search-2']"
        :search-value="searchValue"
      />
    </a-card>

    <!-- 4. 异步加载数据 -->
    <a-card
      title="异步加载数据"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">点击展开时动态加载子节点</span>
      </template>
      <div :class="yellowInfoClassName">
        提示：点击非叶子节点的展开图标，将模拟 500ms 延迟加载子节点数据
      </div>
      <a-tree
        :tree-data="asyncTreeData"
        :load-data="onLoadData"
      />
    </a-card>

    <!-- 5. 拖拽排序树 -->
    <a-card
      title="拖拽排序树"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">拖拽节点重新排列顺序</span>
      </template>
      <div :class="greenInfoClassName">
        提示：按住节点拖动到目标位置释放即可调整顺序
      </div>
      <a-tree
        :tree-data="draggableTreeData"
        draggable
        :allow-drop="allowDrop"
        :default-expanded-keys="['drag-1']"
        @drop="onDrop"
      />
    </a-card>

    <!-- 6. 带操作按钮的树 -->
    <a-card
      title="带操作按钮的树"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">每个节点支持增删改操作</span>
      </template>
      <a-tree
        :tree-data="actionTreeData"
        :default-expanded-keys="['action-1',
                                 'action-1-1',
                                 'action-1-2',
                                 'action-1-3']"
      >
        <template #title="{ title, key }">
          <div :class="actionNodeClassName">
            <span class="flex-1">{{ title }}</span>
            <div :class="actionButtonsClassName">
              <a-button
                type="link"
                size="small"
                @click.stop="handleEdit(key, title)"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </template>
              </a-button>
              <a-button
                type="link"
                size="small"
                danger
                @click.stop="handleDelete(key)"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </template>
              </a-button>
              <a-button
                type="link"
                size="small"
                @click.stop="handleAddChild(key)"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line
                      x1="12"
                      y1="5"
                      x2="12"
                      y2="19"
                    />
                    <line
                      x1="5"
                      y1="12"
                      x2="19"
                      y2="12"
                    />
                  </svg>
                </template>
              </a-button>
            </div>
          </div>
        </template>
      </a-tree>
    </a-card>

    <!-- 7. 连接线样式 -->
    <a-card
      title="连接线样式"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">使用 showLine 属性显示树形连接线</span>
      </template>
      <a-tree
        :tree-data="lineTreeData"
        show-line
        :default-expanded-keys="['line-1',
                                 'line-1-1',
                                 'line-1-2',
                                 'line-1-3']"
      >
        <template #title="{ title }">
          <span class="font-medium">{{ title }}</span>
        </template>
      </a-tree>
    </a-card>

    <!-- 8. 虚拟滚动树（大数据量性能优化） -->
    <a-card
      title="虚拟滚动树"
      variant="borderless"
    >
      <template #extra>
        <span class="text-gray-400 text-sm">1000+ 节点的性能优化演示</span>
      </template>
      <div :class="purpleInfoClassName">
        性能提示：本示例包含 1 个根节点 + 100 个分组 + 1000 个叶子节点，总计 1101 个节点。
        使用虚拟滚动技术确保流畅渲染。
      </div>
      <div
        :class="virtualScrollContainerClassName"
        style="height: 400px;"
      >
        <a-tree
          :tree-data="virtualTreeData"
          :expanded-keys="virtualExpandedKeys"
          :virtual-scroll="true"
          :height="380"
        >
          <template #title="{ title }">
            <span>{{ title }}</span>
          </template>
        </a-tree>
      </div>
    </a-card>
  </div>
</template>
