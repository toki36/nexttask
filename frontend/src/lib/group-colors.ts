import type { TaskGroup } from "@/types";

const groupColors = ["#4f46e5", "#0f766e", "#2563eb", "#7c3aed", "#0369a1", "#a21caf", "#3f6212"];

export function groupColor(groups: TaskGroup[], groupID?: string | null) {
  if (!groupID) return "#5f6b76";
  const index = groups.findIndex((group) => group.id === groupID);
  return index >= 0 ? groupColors[index % groupColors.length] : "#5f6b76";
}
