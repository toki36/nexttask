import type { User } from "@/types";
import { tokenKey, userKey } from "@/lib/api";

export function savedToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(tokenKey) ?? "";
}

export function savedUser() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(userKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
}
