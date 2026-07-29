import type { ScheduleFormState, TaskFormState } from "@/types";

export const initialScheduleForm: ScheduleFormState = {
  title: "",
  group_id: "",
  location_name: "",
  all_day: false,
  start_time: "",
  end_time: "",
};

export const initialTaskForm: TaskFormState = {
  title: "",
  description: "",
  group_id: "",
  location_name: "",
  start_time: "",
  deadline: "",
  estimated_minutes: "30",
  importance: "2",
};
