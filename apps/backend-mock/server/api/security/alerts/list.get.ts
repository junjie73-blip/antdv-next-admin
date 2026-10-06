import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { generateAlerts } from '../../../utils/db/security'

export default defineMockRoute({
  handler: () => success({ list: generateAlerts(8), total: 8 }, 'ok'),
  method: 'GET',
  path: '/security/alerts/list',
})
