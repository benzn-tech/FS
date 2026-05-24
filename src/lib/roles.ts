import { type Role } from '@/types'

export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  editor_plus: 2,
  site_admin: 3,
  org_admin: 4,
  super_admin: 5,
}

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}
