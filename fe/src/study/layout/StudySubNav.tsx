import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import {
  FileTextOutlined,
  ReadOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const tabs = [
  {
    to: "/study",
    label: "Từ vựng",
    icon: ReadOutlined,
    match: (path: string) =>
      path === "/study" ||
      path === "/study/" ||
      (path.startsWith("/study/lists") &&
        !path.includes("/manage") &&
        !path.includes("/cases")),
  },
  {
    to: "/study/cases",
    label: "Case Study",
    icon: FileTextOutlined,
    match: (path: string) => path.startsWith("/study/cases"),
  },
  {
    to: "/study/manage",
    label: "Quản lý từ",
    icon: SettingOutlined,
    match: (path: string) =>
      path.startsWith("/study/manage") && !path.startsWith("/study/manage/cases"),
  },
] as const;

function tabClass(active: boolean) {
  return clsx(
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-indigo-50 text-indigo-600"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
  );
}

export function StudySubNav({ variant }: { variant: "top" | "bottom" }) {
  const path = useLocation().pathname;

  if (variant === "bottom") {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Study navigation"
      >
        {tabs.map(({ to, label, icon: Icon, match }) => (
          <Link
            key={to}
            to={to}
            className={clsx(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
              match(path) ? "text-indigo-600" : "text-slate-500",
            )}
          >
            <Icon className="text-lg" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 pb-3"
      aria-label="Study sections"
    >
      {tabs.map(({ to, label, icon: Icon, match }) => (
        <Link key={to} to={to} className={tabClass(match(path))}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
