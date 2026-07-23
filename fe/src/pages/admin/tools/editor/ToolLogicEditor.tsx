import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, Col, Row, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ROOT_CONTAINER_ID,
  collectSortableIds,
  createPaletteNode,
  findNodeLocation,
  getContainerChildren,
  insertNode,
  moveNode,
  parseContainerDropId,
  parsePaletteDragId,
  removeNode,
  updateNode,
  type PaletteType,
  type ToolNode,
} from "../../../../types/automation";
import { ActionPalette } from "./ActionPalette";
import { NodeContainer } from "./NodeContainer";

type Props = {
  nodes: ToolNode[];
  onChange: (nodes: ToolNode[]) => void;
};

export function ToolLogicEditor({ nodes, onChange }: Props) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<PaletteType>("goto");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const sortableIds = useMemo(() => collectSortableIds(nodes), [nodes]);

  const activeNode = useMemo(() => {
    if (!activeId) return null;
    const palette = parsePaletteDragId(activeId);
    if (palette) return createPaletteNode(palette);
    return findNodeLocation(nodes, activeId)?.node ?? null;
  }, [activeId, nodes]);

  const resolveDropTarget = (
    overId: string,
  ): { containerId: string; index: number } | null => {
    const containerId = parseContainerDropId(overId);
    if (containerId) {
      const children = getContainerChildren(nodes, containerId);
      return { containerId, index: children?.length ?? 0 };
    }

    const overLoc = findNodeLocation(nodes, overId);
    if (overLoc) {
      return { containerId: overLoc.containerId, index: overLoc.index };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeNodeId = String(active.id);
    if (parsePaletteDragId(activeNodeId)) return;

    const activeLoc = findNodeLocation(nodes, activeNodeId);
    if (!activeLoc) return;

    const target = resolveDropTarget(String(over.id));
    if (!target) return;

    const moved = moveNode(nodes, activeNodeId, target.containerId, target.index);
    if (moved !== nodes) onChange(moved);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeStr = String(active.id);
    const paletteType = parsePaletteDragId(activeStr);

    if (paletteType) {
      const target = resolveDropTarget(String(over.id));
      if (!target) return;
      const newNode = createPaletteNode(paletteType);
      onChange(insertNode(nodes, target.containerId, target.index, newNode));
      return;
    }

    const target = resolveDropTarget(String(over.id));
    if (!target) return;
    const activeLoc = findNodeLocation(nodes, activeStr);
    if (!activeLoc) return;

    if (
      activeLoc.containerId !== target.containerId ||
      activeLoc.index !== target.index
    ) {
      onChange(moveNode(nodes, activeStr, target.containerId, target.index));
    }
  };

  const handleAdd = () => {
    onChange(
      insertNode(
        nodes,
        ROOT_CONTAINER_ID,
        nodes.length,
        createPaletteNode(selectedType),
      ),
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Row gutter={16}>
        <Col xs={24} lg={6}>
          <Card title={t("automationTools.actionsPanel")} className="mb-4">
            <ActionPalette
              selectedType={selectedType}
              onSelectType={setSelectedType}
              onAdd={handleAdd}
            />
          </Card>
        </Col>
        <Col xs={24} lg={18}>
          <Card title={t("automationTools.mainLogic")} className="mb-4">
            {nodes.length === 0 ? (
              <Typography.Text type="secondary">
                {t("automationTools.noSteps")}
              </Typography.Text>
            ) : (
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <NodeContainer
                  containerId={ROOT_CONTAINER_ID}
                  nodes={nodes}
                  collapsed={collapsed}
                  onToggleCollapse={(id) =>
                    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  onUpdate={(nodeId, updater) =>
                    onChange(updateNode(nodes, nodeId, updater))
                  }
                  onRemove={(nodeId) => onChange(removeNode(nodes, nodeId))}
                />
              </SortableContext>
            )}
          </Card>
        </Col>
      </Row>

      <DragOverlay>
        {activeNode ? (
          <div className="rounded border border-blue-300 bg-white px-3 py-2 shadow-lg">
            {activeNode.type === "block" ||
            activeNode.type === "loop" ||
            activeNode.type === "if"
              ? (activeNode.name ?? activeNode.type)
              : activeNode.type}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
