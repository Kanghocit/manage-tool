import { Outlet, useLocation, Link } from "react-router-dom";
import {
  HomeOutlined,
  ReadOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import { StudyHeader } from "./StudyHeader";
import { StudySidebar } from "./StudySidebar";
import "./study-mobile.css";

export function StudyLayout() {
  const location = useLocation();
  const path = location.pathname;
  const hideBottomNav =
    path.includes("/review") || path.includes("/random");

  const tabClass = (match: boolean) => (match ? "active" : "");

  return (
    <div className="study-shell">
      <StudySidebar />
      <div className="study-content-wrap">
        <StudyHeader />
        <main className="study-main">
          <Outlet />
        </main>
      </div>

      {!hideBottomNav && (
        <nav className="study-bottom-nav" aria-label="Study navigation">
          <Link
            to="/study"
            className={tabClass(
              path === "/study" ||
                path === "/study/" ||
                (path.startsWith("/study/lists") && !path.includes("/manage")),
            )}
          >
            <ReadOutlined />
            <span>Luyện tập</span>
          </Link>
          <Link
            to="/study/manage"
            className={tabClass(path.startsWith("/study/manage"))}
          >
            <SettingOutlined />
            <span>Quản lý</span>
          </Link>
          <Link to="/dashboard" className="">
            <HomeOutlined />
            <span>Về app</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
