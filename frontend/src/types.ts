export type Role = "admin" | "hr" | "new_employee" | "mentor";

export interface User {
  user_id: number;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface UserUpdatePayload {
  email: string;
  role: Role;
  is_active: boolean;
  password?: string;
}

export interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
  hire_date: string;
  position: string;
  department: string;
  mentor_id: number | null;
}

export interface OnboardingTrack {
  track_id: number;
  name: string;
  description: string | null;
  target_position: string;
  duration_days: number;
  is_active: boolean;
  created_by: number;
}

export interface Task {
  task_id: number;
  track_id: number;
  title: string;
  description: string | null;
  task_type: string;
  expected_duration_days: number;
  task_order: number;
  is_mandatory: boolean;
}

export interface EmployeeOnboarding {
  onboarding_id: number;
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  status: string;
  progress_percentage: number;
}

export interface EmployeeOnboardingTask {
  task_id: number;
  title: string;
  description: string | null;
  task_type: string;
  task_order: number;
  expected_duration_days: number;
  completion_id: number | null;
  status: string;
  due_date: string;
  completed_date: string | null;
  notes: string | null;
  attachment_url: string | null;
}

export interface OnboardingRiskFactors {
  overdue_ratio: number;
  pace_drop: number;
  inactivity_days: number;
  negative_feedback: boolean;
}

export interface OnboardingRisk {
  onboarding_id: number;
  employee_id: number;
  employee_name: string;
  track_name: string;
  onboarding_start_date: string;
  days_in_onboarding: number;
  planned_progress: number;
  actual_progress: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  factors: OnboardingRiskFactors;
}

export interface OverdueTaskInfo {
  task_id: number;
  title: string;
  due_date: string;
  status: string;
}

export interface OnboardingRiskDetail {
  onboarding_id: number;
  employee_id: number;
  employee_name: string;
  track_name: string;
  status: string;
  onboarding_start_date: string;
  days_in_onboarding: number;
  planned_progress: number;
  actual_progress: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  factors: OnboardingRiskFactors;
  overdue_tasks: OverdueTaskInfo[];
  last_activity_date: string | null;
  latest_feedback_excerpt: string | null;
}

export interface EWSWeightsPayload {
  overdue_ratio: number;
  pace_drop: number;
  inactivity: number;
  negative_feedback: number;
}

export interface EWSDistributionPreview {
  low: number;
  medium: number;
  high: number;
  average_score: number;
}

export interface KnowledgeBaseItem {
  item_id: number;
  title: string;
  content: string | null;
  file_name: string | null;
  file_url: string | null;
  file_mime_type: string | null;
  created_by: number;
  created_at: string;
}

export interface MentorContact {
  employee_id: number | null;
  mentor_user_id: number;
  mentor_email: string;
}

export interface EmployeeContact {
  employee_id: number;
  employee_name: string;
  user_id: number;
  user_email: string;
}

export interface ChatMessage {
  message_id: number;
  sender_user_id: number;
  text: string;
  created_at: string;
}
