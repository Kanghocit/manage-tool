import { Outlet, useLocation } from "react-router-dom";

import { StudySubNav } from "./StudySubNav";
import "./study-mobile.css";

export function StudyLayout() {
  const path = useLocation().pathname;
  const hideBottomNav = path.includes("/review") || path.includes("/random");

  return (
    <div className="study-shell study-shell--embedded">
      <div className="study-content-wrap">
        <StudySubNav variant="top" />
        <main className="study-main">
          <Outlet />
        </main>
      </div>

      {!hideBottomNav && <StudySubNav variant="bottom" />}
    </div>
  );
}
