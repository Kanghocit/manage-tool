import type { ReactNode } from "react";

export type MenuKey =
  | "/dashboard"
  | "/my-license"
  | "/admin/users"
  | "/admin/licenses"
  | "/admin/license-requests"
  | "/profile";

export type NavRoute = { path: MenuKey; name: string; icon: ReactNode };
