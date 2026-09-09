import { 
  LayoutDashboard, Users, MessageSquare, Filter, Package, Shield, ScrollText, BarChart3, TrendingUp, PieChart
} from 'lucide-react';

export const WORKSPACES = ['Home', 'Analytics'] as const;
export type Workspace = typeof WORKSPACES[number];

export const MAIN_NAV_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard },
  { title: 'Leads', icon: Filter },
  { title: 'Enquiry', icon: MessageSquare },
  { title: 'Quotation', icon: ScrollText },
  { title: 'Products', icon: Package },
  { title: 'Business Partner', icon: Users },
  { title: 'Administration', icon: Shield },
];

export const ANALYTICS_NAV_ITEMS = [
  { title: 'Overview', icon: BarChart3 },
];

export const SIDEBAR_CONFIG: Record<Workspace, { title: string, icon: any }[]> = {
  Home: MAIN_NAV_ITEMS,
  Analytics: ANALYTICS_NAV_ITEMS
};

