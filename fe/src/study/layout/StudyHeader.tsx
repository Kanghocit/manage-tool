import { Link, useLocation } from "react-router-dom";

export function StudyHeader() {
  const path = useLocation().pathname;

  const isActive = (prefix: string) =>
    prefix === "/study"
      ? path === "/study" || path === "/study/" || (path.startsWith("/study/lists") && !path.includes("/manage"))
      : path.startsWith(prefix);

  return (
    <header className="study-header study-header-mobile">
      <div className="study-header-inner">
        <Link to="/study" className="study-header-brand">
          <span className="study-header-logo">S</span>
          <span>StudyLang</span>
        </Link>
        <nav className="study-header-nav">
          <Link
            to="/study"
            className={`study-nav-link${isActive("/study") ? " active" : ""}`}
          >
            Luyện tập
          </Link>
          <Link
            to="/study/manage"
            className={`study-nav-link${isActive("/study/manage") ? " active" : ""}`}
          >
            Quản lý
          </Link>
        </nav>
      </div>
    </header>
  );
}
