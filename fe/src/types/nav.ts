import type { ReactNode } from "react";

export type MenuKey =
  | "/dashboard"
  | "/guide"
  | "/my-license"
  | "/admin/users"
  | "/admin/licenses"
  | "/admin/license-packages"
  | "/admin/license-requests"
  | "/profile";

export type NavRoute = { path: MenuKey; name: string; icon: ReactNode };
