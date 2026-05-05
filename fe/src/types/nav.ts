import type { ReactNode } from "react";

export type MenuKey =
  | "/dashboard"
  | "/my-license"
  | "/admin/users"
  | "/admin/licenses"
  | "/profile";

export type NavRoute = { path: MenuKey; name: string; icon: ReactNode };
