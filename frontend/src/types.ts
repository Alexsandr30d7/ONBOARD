export type Role = "admin" | "hr" | "new_employee" | "mentor";

export interface User {
  user_id: number;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
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
