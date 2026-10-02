import type { UserGroupRecord } from './api'

export type {
  UserGroupRecord,
  UserGroupDetail,
  UserGroupListParams,
  UserGroupCreateParams,
  UserGroupUpdateParams,
  GroupMember,
  GroupRole,
  UserGroupType,
} from './api'

export interface UserGroupActionContext {
  onEdit: (record: UserGroupRecord) => void
  onMembers: (record: UserGroupRecord) => void
  onRoles: (record: UserGroupRecord) => void
  onDelete: (record: UserGroupRecord) => void | Promise<void>
}
