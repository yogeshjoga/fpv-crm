import { supabase } from './supabase';

// The members and analytics functions are newer than the generated database types, so they are called through these small typed helpers.
type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;

export function rpc<T>(name: string, args?: Record<string, unknown>): Result<T> {
  return supabase.rpc(name as never, args as never) as unknown as Result<T>;
}

export function table(name: string) {
  return supabase.from(name as never) as unknown as ReturnType<typeof supabase.from>;
}

export interface MemberRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  college_name: string;
  member_type: 'individual' | 'paid' | 'workshop';
  account_kind: 'student' | 'member';
  signup_source: string;
  status: string;
  created_at: string;
  last_seen_at: string | null;
  workshops: string;
  workshop_dates: string;
  workshop_ids: string[];
  is_paid: boolean;
}

export interface MembersOverview {
  total: number;
  members: number;
  by_type: Record<string, number>;
  colleges: { college: string; n: number }[];
  missing_college: number;
}

export interface TrafficSummary {
  visits: number;
  humans: number;
  unique_visitors: number;
  pageviews: number;
  clicks: number;
  avg_seconds: number;
  members_visits: number;
  by_day: { day: string; human: number; bots: number }[];
  by_class: Record<string, number>;
  top_pages: { path: string; n: number }[];
  sources: { kind: string; name: string; n: number }[];
  ai_sources: { name: string; n: number }[];
  bots: { class: string; name: string; n: number }[];
  countries: { country: string; n: number }[];
  places: { country: string; region: string; city: string; n: number }[];
  devices: { device: string; n: number }[];
  browsers: { browser: string; n: number }[];
  clicks_top: { target: string; path: string; n: number }[];
  signups: number;
  signins: number;
}

export interface RecentVisit {
  started_at: string;
  entry_path: string;
  source_kind: string;
  source_name: string;
  country: string;
  region: string;
  city: string;
  device: string;
  browser: string;
  traffic_class: string;
  bot_name: string;
  pages: number;
  clicks: number;
  duration_s: number;
  member: boolean;
}
