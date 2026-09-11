import {
  AppstoreOutlined,
  HomeOutlined,
  ReadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/study", label: "Luyện tập", icon: <ReadOutlined />, match: (p: string) => p === "/study" || (p.startsWith("/study/lists") && !p.includes("/manage")) },
  { to: "/study/manage", label: "Quản lý list", icon: <SettingOutlined />, match: (p: string) => p.startsWith("/study/manage") },
  { to: "/dashboard", label: "Về Kang Tools", icon: <HomeOutlined />, match: () => false },
];

export function StudySidebar() {
  const path = useLocation().pathname;

  return (
    <aside className="study-sidebar" aria-label="Study menu">
      <div className="study-sidebar-brand">
        <AppstoreOutlined className="study-sidebar-brand-icon" />
        <div>
          <strong>StudyLang</strong>
          <span>Luyện từ vựng</span>
        </div>
      </div>
      <nav className="study-sidebar-nav">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`study-sidebar-link${item.match(path) ? " active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
