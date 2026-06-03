declare module '@wangeditor/editor-for-vue' {
  import type { Component } from 'vue'
  import type { IDomEditor, IEditorConfig, IToolbarConfig, SlateDescendant, SlateElement, SlateText } from '@wangeditor/editor'

  export const Editor: Component<{
    defaultConfig?: Partial<IEditorConfig>
    mode?: string
    defaultHtml?: string
    defaultContent?: SlateDescendant[]
    style?: Record<string, string>
    class?: string
    onCreated?: (editor: IDomEditor) => void
    onChange?: (editor: IDomEditor) => void
    onDestroyed?: (editor: IDomEditor) => void
    onFocus?: (editor: IDomEditor) => void
    onBlur?: (editor: IDomEditor) => void
    onCustomAlert?: (info: string, type: string) => void
    onCustomPaste?: (editor: IDomEditor, event: ClipboardEvent, callback: (value: boolean) => void) => void
  }>

  export const Toolbar: Component<{
    editor?: IDomEditor | null
    defaultConfig?: Partial<IToolbarConfig>
    mode?: string
    style?: Record<string, string>
    class?: string
  }>
}