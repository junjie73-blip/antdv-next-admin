import { success } from '../../../../utils/response'
import { defineMockRoute } from '../../../../utils/runtime'

export default defineMockRoute({
  handler: () => success({ success: true, message: '处置成功' }, '处置成功'),
  method: 'POST',
  path: '/security/alerts/:alertId/handle',
})
