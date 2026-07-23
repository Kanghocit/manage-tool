import { useDroppable } from "@dnd-kit/core";
import { Typography } from "antd";
import { useTranslation } from "react-i18next";

import { containerDropId, type ToolNode } from "../../../../types/automation";
import { SortableNodeCard } from "./SortableNodeCard";

type Props = {
  containerId: string;
  nodes: ToolNode[];
  collapsed: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onUpdate: (nodeId: string, updater: (node: ToolNode) => ToolNode) => void;
  onRemove: (nodeId: string) => void;
};

export function NodeContainer({
  containerId,
  nodes,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: containerDropId(containerId),
    data: { type: "container", containerId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-0 ${isOver ? "rounded bg-blue-50/30" : ""}`}
    >
      {nodes.length === 0 ? (
        <Typography.Text type="secondary" className="text-xs">
          {t("automationTools.dropHere")}
        </Typography.Text>
      ) : (
        nodes.map((node, index) => (
          <SortableNodeCard
            key={node.id ?? index}
            node={node}
            index={index}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))
      )}
    </div>
  );
}
