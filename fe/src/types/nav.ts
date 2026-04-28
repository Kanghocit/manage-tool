import type { ReactNode } from "react";

export type MenuKey =
  | "/dashboard"
  | "/my-tools"
  | "/admin/users"
  | "/admin/tools"
  | "/admin/subscriptions"
  | "/profile";

export type NavRoute = { path: MenuKey; name: string; icon: ReactNode };

