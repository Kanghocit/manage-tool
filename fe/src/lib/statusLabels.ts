import type { TFunction } from "i18next";

export function licenseStatusLabel(status: string, t: TFunction): string {
  return t(`licenseStatus.${status}`, { defaultValue: status });
}

export function userStatusLabel(status: string, t: TFunction): string {
  return t(`userStatus.${status}`, { defaultValue: status });
}

export function licenseStatusColor(status: string): string {
  if (status === "active") return "green";
  if (status === "blocked") return "red";
  if (status === "expired") return "default";
  return "blue";
}

export function userStatusColor(status: string): string {
  return status === "active" ? "green" : "red";
}
