import { Navigate, Route, Routes } from "react-router-dom";

import { StudyLayout } from "./layout/StudyLayout";
import { StudyDashboard } from "./components/StudyDashboard";
import { ListDetail } from "./components/ListDetail";
import { ReviewSession } from "./components/ReviewSession";
import { RandomBrowse } from "./components/RandomBrowse";
import { ManageLists } from "./components/ManageLists";
import { ManageListDetail } from "./components/ManageListDetail";
import { CaseStudyHub } from "./components/CaseStudyHub";
import {
  RedirectManageCaseDetail,
  RedirectManageCasesList,
} from "./components/CaseStudyRedirects";
import { ManageCaseStudyDetail } from "./components/ManageCaseStudyDetail";
import { AdminCaseStudyRoute } from "./components/AdminCaseStudyRoute";

export function StudyRoutes() {
  return (
    <Routes>
      <Route element={<StudyLayout />}>
        <Route index element={<StudyDashboard />} />
        <Route
          path="cases"
          element={
            <AdminCaseStudyRoute>
              <CaseStudyHub />
            </AdminCaseStudyRoute>
          }
        />
        <Route
          path="cases/:setId/edit"
          element={
            <AdminCaseStudyRoute>
              <ManageCaseStudyDetail />
            </AdminCaseStudyRoute>
          }
        />
        <Route path="manage/cases" element={<RedirectManageCasesList />} />
        <Route path="manage/cases/:setId" element={<RedirectManageCaseDetail />} />
        <Route path="lists/:listId" element={<ListDetail />} />
        <Route path="lists/:listId/review" element={<ReviewSession />} />
        <Route path="lists/:listId/random" element={<RandomBrowse />} />
        <Route path="manage" element={<ManageLists />} />
        <Route path="manage/:listId" element={<ManageListDetail />} />
        <Route path="*" element={<Navigate to="/study" replace />} />
      </Route>
    </Routes>
  );
}
