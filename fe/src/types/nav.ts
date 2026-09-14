import type { ReactNode } from "react";

export type MenuKey =
  | "/dashboard"
  | "/guide"
  | "/study"
  | "/study/cases"
  | "/study/manage"
  | "/my-license"
  | "/support"
  | "/admin/users"
  | "/admin/licenses"
  | "/admin/license-packages"
  | "/admin/license-requests"
  | "/admin/support"
  | "/profile";

export type NavRoute = {
  path: MenuKey;
  name: string;
  icon: ReactNode;
  badge?: number;
};
