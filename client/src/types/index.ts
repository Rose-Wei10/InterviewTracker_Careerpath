export const statuses = [
  "Applied",
  "OA",
  "Interview",
  "Final Round",
  "Offer",
  "Reject",
  "Ghosted",
] as const;
export type Status = (typeof statuses)[number];
export interface Application {
  id: string;
  company: string;
  role: string;
  status: Status;
  appliedDate: string;
  location?: string | null;
  salary?: string | null;
  jobLink?: string | null;
  notes?: string | null;
  resumeId?: string | null;
  jobDescription?: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
  interviews?: Interview[];
  events?: CalendarEvent[];
  resume?: { id: string; name: string } | null;
}
export interface Activity {
  id: string;
  kind: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  applicationId?: string;
  application?: { id?: string; company: string; role: string };
}
export interface Interview {
  id: string;
  applicationId: string;
  title: string;
  startsAt: string;
  timeZone: string;
  type: string;
  status: string;
  notes?: string;
  application?: { id: string; company: string; role: string };
}
export interface Resume {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  version: number;
  size?: number;
  originalName?: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface DashboardData {
  total: number;
  counts: Record<Status, number>;
  responseRate: number;
  interviewRate: number;
  rateLabel: string;
  recent: Activity[];
  upcoming: CalendarEvent[];
  upcomingCount: number;
  attention: CalendarEvent[];
  attentionCount: number;
  ghostCount: number;
  weekly: { date: string; count: number }[];
  monthly: { date: string; count: number }[];
}
export interface AnalysisResult {
  supportedSkills: { skill: string; quote: string }[];
  missingSkills: string[];
  improvements: { original: string; suggestion: string }[];
  preparationTopics: string[];
  heuristicScore: number;
  assessmentLabel: string;
}
export interface Analysis {
  id: string;
  mode: string;
  createdAt: string;
  result: AnalysisResult | FreeReviewResult | null;
  status: "pending" | "completed" | "failed";
  failureReason?: string | null;
  resumeId?: string | null;
  applicationId?: string | null;
  jobDescription: string;
  resume: { name: string } | null;
  application?: { id: string; company: string; role: string } | null;
}

export type EventCategory = "OA" | "Interview" | "Other";
export interface CalendarEvent {
  id: string;
  applicationId: string | null;
  application?: { id: string; company: string; role: string } | null;
  title: string;
  category: EventCategory;
  startsAt: string;
  timeZone: string;
  allDay: boolean;
  type: string;
  notes?: string | null;
  status: "Scheduled" | "Completed" | "Cancelled";
  reminderMinutes: number | null;
  needsAttention?: boolean;
  overdue?: boolean;
  reminderAt?: string | null;
}

export interface Requirement {
  term: string;
  kind: "keyword" | "manual";
}
export interface FreeReviewResult {
  schemaVersion: 2;
  checks: (Requirement & { found: boolean; quote: string | null })[];
  foundCount: number;
  keywordCount: number;
  improvements: { original: string; suggestions: string[] }[];
  preparationTopics: string[];
  warnings: string[];
}
