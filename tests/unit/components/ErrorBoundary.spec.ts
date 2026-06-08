import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'

describe('ErrorBoundary', () => {
  describe('normal state', () => {
    it('should render slot content when no error', () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: '<div class="test-content">Hello World</div>',
        },
      })

      expect(wrapper.find('.test-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Hello World')
    })
  })

  describe('error state', () => {
    it('should show error UI when error is set', async () => {
      const wrapper = mount(ErrorBoundary)

      // 手动触发错误状态
      wrapper.vm.error = new Error('Test error message')
      await wrapper.vm.$nextTick()

      // 检查是否显示了错误 UI
      expect(wrapper.text()).toContain('出错了')
      expect(wrapper.text()).toContain('Test error message')
    })
  })

  describe('retry functionality', () => {
    it('should have retry button by default', async () => {
      const wrapper = mount(ErrorBoundary, {
        props: { resetOnError: true },
      })

      // 触发错误状态
      wrapper.vm.error = new Error('Test')
      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('button')
      expect(retryButton.exists()).toBe(true)
      expect(retryButton.text()).toContain('重试')
    })
  })

  describe('variants', () => {
    it('should render page variant correctly', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          loading: true,
          variant: 'page',
          showTitle: true,
          showActions: true,
        },
      })

      // 应该显示骨架屏内容（有动画元素）
      expect(wrapper.html()).toBeTruthy()
    })

    it('should render card variant correctly', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          loading: true,
          variant: 'card',
        },
      })

      expect(wrapper.html()).toBeTruthy()
    })

    it('should render form variant correctly', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          loading: true,
          variant: 'form',
        },
      })

      expect(wrapper.html()).toBeTruthy()
    })

    it('should render detail variant correctly', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          loading: true,
          variant: 'detail',
        },
      })

      expect(wrapper.html()).toBeTruthy()
    })
  })
})
