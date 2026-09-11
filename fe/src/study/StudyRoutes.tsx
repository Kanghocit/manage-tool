import { Navigate, Route, Routes } from "react-router-dom";

import { StudyLayout } from "./layout/StudyLayout";
import { StudyDashboard } from "./components/StudyDashboard";
import { ListDetail } from "./components/ListDetail";
import { ReviewSession } from "./components/ReviewSession";
import { RandomBrowse } from "./components/RandomBrowse";
import { ManageLists } from "./components/ManageLists";
import { ManageListDetail } from "./components/ManageListDetail";

export function StudyRoutes() {
  return (
    <Routes>
      <Route element={<StudyLayout />}>
        <Route index element={<StudyDashboard />} />
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
