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
  followUpAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
  interviews?: Interview[];
  resume?: { id: string; name: string } | null;
}
export interface Activity {
  id: string;
  kind: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  application?: { company: string; role: string };
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
  upcoming: Interview[];
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
  result: AnalysisResult | null;
  resume: { name: string };
}
