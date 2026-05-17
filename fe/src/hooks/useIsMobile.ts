import { Grid } from "antd";

/** True when viewport is below Ant Design `md` (< 768px), e.g. iPhone 15 Pro portrait. */
export function useIsMobile(): boolean {
  const screens = Grid.useBreakpoint();
  if (screens.md === undefined) return false;
  return !screens.md;
}
