export type User = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type TaskGroup = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Schedule = {
  id: string;
  user_id: string;
  group_id: string;
  group?: TaskGroup;
  title: string;
  location_name?: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  group_id?: string | null;
  group?: TaskGroup | null;
  title: string;
  description: string;
  location_name?: string | null;
  deadline: string;
  estimated_minutes: number;
  weight: number;
  priority_score: number;
  status: "open" | "completed";
};

export type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type ActiveView = "schedules" | "tasks";
export type AuthMode = "login" | "register";

export type ScheduleFormState = {
  title: string;
  group_id: string;
  location_name: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
};

export type TaskFormState = {
  title: string;
  description: string;
  group_id: string;
  location_name: string;
  deadline: string;
  estimated_minutes: string;
  weight: string;
};
