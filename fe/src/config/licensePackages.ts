import type { PackageCode } from "../types/purchase";

export type LicensePackagePeriod =
  | { unit: "month"; months: number }
  | { unit: "day"; days: number };

export type LicensePackageUi = {
  code: PackageCode;
  durationDays: number;
  amountVnd: number;
  period: LicensePackagePeriod;
  /** Tailwind accent classes for card border / header */
  theme: string;
  icon: string;
  /** i18n prefix under `pages` */
  i18nPrefix: string;
  advantageIds: ("a1" | "a2" | "a3")[];
  /** If true, only show this package to admin users */
  adminOnly?: boolean;
};

export const LICENSE_PACKAGES_UI: LicensePackageUi[] = [
  {
    code: "PKG_1D",
    durationDays: 1,
    amountVnd: 25_000,
    period: { unit: "day", days: 1 },
    theme: "border-slate-300 bg-gradient-to-b from-slate-100/90 to-white",
    icon: "🧪",
    i18nPrefix: "pkg1d",
    advantageIds: ["a1", "a2", "a3"],
  },
  {
    code: "PKG_3M",
    durationDays: 90,
    amountVnd: 1_500_000,
    period: { unit: "month", months: 3 },
    theme: "border-blue-200 bg-gradient-to-b from-blue-50/80 to-white",
    icon: "✈️",
    i18nPrefix: "pkg3m",
    advantageIds: ["a1", "a2", "a3"],
  },
  {
    code: "PKG_6M",
    durationDays: 180,
    amountVnd: 2_400_000,
    period: { unit: "month", months: 6 },
    theme: "border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white",
    icon: "🚀",
    i18nPrefix: "pkg6m",
    advantageIds: ["a1", "a2", "a3"],
  },
  {
    code: "PKG_12M",
    durationDays: 365,
    amountVnd: 4_000_000,
    period: { unit: "month", months: 12 },
    theme: "border-amber-200 bg-gradient-to-b from-amber-50/80 to-white",
    icon: "🎯",
    i18nPrefix: "pkg12m",
    advantageIds: ["a1", "a2", "a3"],
  },
  {
    code: "PKG_24M",
    durationDays: 730,
    amountVnd: 6_000_000,
    period: { unit: "month", months: 24 },
    theme: "border-violet-200 bg-gradient-to-b from-violet-50/80 to-white",
    icon: "💎",
    i18nPrefix: "pkg24m",
    advantageIds: ["a1", "a2", "a3"],
  },
];
