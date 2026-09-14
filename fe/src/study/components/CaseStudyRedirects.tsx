import { Navigate, useParams } from "react-router-dom";

export function RedirectManageCasesList() {
  return <Navigate to="/study/cases?tab=manage" replace />;
}

export function RedirectManageCaseDetail() {
  const { setId = "" } = useParams();
  return <Navigate to={`/study/cases/${setId}/edit`} replace />;
}
