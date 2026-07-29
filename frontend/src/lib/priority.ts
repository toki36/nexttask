export type TaskPriorityLevel = "urgent" | "high" | "normal";

export function taskPriorityLevel(score: number): TaskPriorityLevel {
  if (score >= 80) return "urgent";
  if (score >= 60) return "high";
  return "normal";
}

export function taskPriorityLabel(level: TaskPriorityLevel) {
  if (level === "urgent") return "Urgent";
  if (level === "high") return "High priority";
  return "";
}
