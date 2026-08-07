import {
  LayoutDashboard,
  Radio,
  CalendarDays,
  AlertTriangle,
  Users,
  UserPlus,
  BarChart3,
  Cpu,
  KeyRound,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { ConsoleRole } from '@/types/database'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Roles allowed to see this item. */
  roles: ConsoleRole[]
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

/**
 * Console navigation.
 *
 * Supervisors see attendance and workforce, but never Enrollment, Devices,
 * Audit Log or Settings — those touch biometric data and system config.
 * The sidebar filters on these, and the routes enforce it again; the menu
 * hiding an item is presentation, not security.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Attendance',
    items: [
      { label: 'Overview',        to: '/',                icon: LayoutDashboard, roles: ['admin', 'supervisor'] },
      { label: 'Live Attendance', to: '/live',            icon: Radio,           roles: ['admin', 'supervisor'] },
      { label: 'Shift Roster',    to: '/roster',          icon: CalendarDays,    roles: ['admin', 'supervisor'] },
      { label: 'Exceptions',      to: '/exceptions',      icon: AlertTriangle,   roles: ['admin', 'supervisor'] },
    ],
  },
  {
    heading: 'Workforce',
    items: [
      { label: 'Staff Directory', to: '/staff',           icon: Users,           roles: ['admin', 'supervisor'] },
      { label: 'Enrollment',      to: '/enrollment',      icon: UserPlus,        roles: ['admin'] },
      { label: 'Reports',         to: '/reports',         icon: BarChart3,       roles: ['admin', 'supervisor'] },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Devices',         to: '/devices',         icon: Cpu,             roles: ['admin'] },
      { label: 'Access',          to: '/access',          icon: KeyRound,        roles: ['admin'] },
      { label: 'Audit Log',       to: '/audit',           icon: ScrollText,      roles: ['admin'] },
      { label: 'Settings',        to: '/settings',        icon: Settings,        roles: ['admin'] },
    ],
  },
]

export function navGroupsForRole(role: ConsoleRole | undefined): NavGroup[] {
  if (!role) return []
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}
