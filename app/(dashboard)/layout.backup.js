// Initial navigation structure without counts
const initialNavigation = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Admin Management', icon: Shield, href: '/users' },
  { name: 'Course Management', icon: GraduationCap, href: '/course-management' },
  { name: 'Verification Center', icon: FileText, href: '/passports' },
  {
    name: 'Approval Center',
    icon: CheckCircle,
    href: '/approvals',
    subItems: [
      { name: 'Universities', href: '/approvals?tab=universities', icon: Building2, pendingCount: 0 },
      { name: 'Recruiters', href: '/approvals?tab=recruiters', icon: Briefcase, pendingCount: 0 },
      { name: 'Colleges', href: '/approvals?tab=colleges', icon: School, pendingCount: 0 },
      { name: 'Students', href: '/approvals?tab=students', icon: Users, pendingCount: 0 },
      { name: 'Courses', href: '/approvals?tab=courses', icon: BookOpen, pendingCount: 0 },
    ]
  },
  {
    name: 'Reports & Analytics',
    icon: BarChart3,
    href: '/reports',
    subItems: [
      { name: 'Universities', href: '/reports?tab=universities', icon: Building2 },
      { name: 'Recruiters', href: '/reports?tab=recruiters', icon: Briefcase },
      { name: 'Placements', href: '/reports?tab=placements', icon: Trophy },
      { name: 'Heatmap', href: '/reports?tab=heatmap', icon: MapPin },
      { name: 'Insights', href: '/reports?tab=insights', icon: Brain },
    ]
  },
  { name: 'Audit Logs', icon: History, href: '/audit-logs' },
  { name: 'Integrations', icon: Plug, href: '/integrations' },
  { name: 'Settings', icon: Settings, href: '/settings' },
]
