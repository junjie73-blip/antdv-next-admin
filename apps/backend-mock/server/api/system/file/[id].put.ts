import dayjs from 'dayjs'
import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { FILE_DB, getFileTypeFromExt } from '../../../utils/db/file'

export default defineMockRoute({
  handler({ data, params }) {
    const id = Number(params.id)
    const file = FILE_DB.find(f => f.id === id)

    if (!file) {
      return bizError(404, '文件不存在')
    }

    const newName = String(data.name || '')

    if (newName) {
      file.name = newName
      if (!file.isFolder) {
        const ext = newName.split('.').pop() || ''
        const fileInfo = getFileTypeFromExt(ext)
        file.extension = ext
        file.type = fileInfo.type
        file.mimeType = fileInfo.mimeType
      }
    }

    file.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')

    return success(file, '重命名成功')
  },
  method: 'PUT',
  path: '/system/file/:id',
})
