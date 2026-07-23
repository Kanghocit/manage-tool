import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Card,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  DownOutlined,
  HolderOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";

import {
  containerDropId,
  branchContainerId,
  getNodeId,
  isActionStep,
  isContainerNode,
  isIfNode,
  BRANCH_THEN,
  BRANCH_ELSE,
  type ActionStep,
  type BlockNode,
  type IfNode,
  type LoopNode,
  type ToolNode,
  type ConditionKind,
  type ConditionMode,
} from "../../../../types/automation";
import { StepFields } from "./StepFields";
import { NodeContainer } from "./NodeContainer";

type Props = {
  node: ToolNode;
  index: number;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onUpdate: (nodeId: string, updater: (node: ToolNode) => ToolNode) => void;
  onRemove: (nodeId: string) => void;
};

export function SortableNodeCard(props: Props) {
  if (isActionStep(props.node)) {
    return <ActionNodeCard {...props} node={props.node} />;
  }
  if (props.node.type === "if") {
    return <IfNodeCard {...props} node={props.node} />;
  }
  if (props.node.type === "loop") {
    return <LoopNodeCard {...props} node={props.node} />;
  }
  return <BlockNodeCard {...props} node={props.node} />;
}

function useSortableNode(nodeId: string) {
  return useSortable({ id: nodeId, data: { type: "node", nodeId } });
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  return (
    <span
      className="cursor-grab text-slate-400 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <HolderOutlined />
    </span>
  );
}

function ActionNodeCard({
  node,
  index,
  onUpdate,
  onRemove,
}: Props & { node: ActionStep }) {
  const { t } = useTranslation();
  const nodeId = getNodeId(node);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortableNode(nodeId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <Card
        size="small"
        title={
          <Space>
            <DragHandle attributes={attributes} listeners={listeners} />
            <IndexBadge>{index + 1}</IndexBadge>
            <span>{t(`automationTools.stepTypes.${node.type}`)}</span>
          </Space>
        }
        extra={
          <Popconfirm
            title={t("automationTools.deleteStepConfirm")}
            onConfirm={() => onRemove(nodeId)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        }
      >
        <StepFields
          step={node}
          onChange={(next) => onUpdate(nodeId, () => next)}
        />
      </Card>
    </div>
  );
}

function BlockNodeCard({
  node,
  index,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onRemove,
}: Props & { node: BlockNode }) {
  return (
    <ContainerNodeCard
      node={node}
      index={index}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onUpdate={onUpdate}
      onRemove={onRemove}
      accentClass="border-l-blue-400"
      typeLabel="block"
    />
  );
}

function LoopNodeCard({
  node,
  index,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onRemove,
}: Props & { node: LoopNode }) {
  return (
    <ContainerNodeCard
      node={node}
      index={index}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onUpdate={onUpdate}
      onRemove={onRemove}
      accentClass="border-l-orange-400"
      typeLabel="loop"
      loopCount={node.loopCount}
    />
  );
}

function IfNodeCard({
  node,
  index,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onRemove,
}: Props & { node: IfNode }) {
  const { t } = useTranslation();
  const nodeId = getNodeId(node);
  const isCollapsed = collapsed[nodeId] ?? false;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortableNode(nodeId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const conditionKinds: ConditionKind[] = ["hasElement", "notHasElement"];
  const conditionModes: ConditionMode[] = ["visible", "exists"];

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <Card
        size="small"
        className="border-l-4 border-l-emerald-400"
        title={
          <Space wrap>
            <DragHandle attributes={attributes} listeners={listeners} />
            <IndexBadge>{index + 1}</IndexBadge>
            <span>{t("automationTools.stepTypes.if")}</span>
            <Input
              size="small"
              value={node.name ?? ""}
              placeholder={t("automationTools.blockName")}
              className="w-36"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                onUpdate(nodeId, (n) =>
                  isIfNode(n) ? { ...n, name: e.target.value } : n,
                )
              }
            />
          </Space>
        }
        extra={
          <Space>
            <Button
              size="small"
              type="text"
              icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => onToggleCollapse(nodeId)}
            />
            <Popconfirm
              title={t("automationTools.deleteBlockConfirm")}
              onConfirm={() => onRemove(nodeId)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        }
      >
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <Typography.Text strong className="mb-2 block text-xs">
                {t("automationTools.ifCondition")}
              </Typography.Text>
              <Space wrap className="w-full">
                <Select
                  size="small"
                  value={node.condition.kind}
                  className="min-w-36"
                  onChange={(kind: ConditionKind) =>
                    onUpdate(nodeId, (n) =>
                      isIfNode(n)
                        ? { ...n, condition: { ...n.condition, kind } }
                        : n,
                    )
                  }
                  options={conditionKinds.map((k) => ({
                    value: k,
                    label: t(`automationTools.condKind.${k}`),
                  }))}
                />
                <Select
                  size="small"
                  value={node.condition.mode ?? "visible"}
                  className="min-w-28"
                  onChange={(mode: ConditionMode) =>
                    onUpdate(nodeId, (n) =>
                      isIfNode(n)
                        ? { ...n, condition: { ...n.condition, mode } }
                        : n,
                    )
                  }
                  options={conditionModes.map((m) => ({
                    value: m,
                    label: t(`automationTools.condMode.${m}`),
                  }))}
                />
                <InputNumber
                  size="small"
                  min={100}
                  max={120000}
                  value={node.condition.timeoutMs ?? 3000}
                  addonAfter="ms"
                  onChange={(v) =>
                    onUpdate(nodeId, (n) =>
                      isIfNode(n)
                        ? {
                            ...n,
                            condition: {
                              ...n.condition,
                              timeoutMs: v ?? 3000,
                            },
                          }
                        : n,
                    )
                  }
                />
              </Space>
              <Input.TextArea
                rows={2}
                className="mt-2"
                value={node.condition.xpath}
                placeholder="//button[@id='submit']"
                onChange={(e) =>
                  onUpdate(nodeId, (n) =>
                    isIfNode(n)
                      ? {
                          ...n,
                          condition: { ...n.condition, xpath: e.target.value },
                        }
                      : n,
                  )
                }
              />
            </div>

            <BranchSection
              label={t("automationTools.thenBranch")}
              containerId={branchContainerId(nodeId, BRANCH_THEN)}
              nodes={node.then}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onUpdate={onUpdate}
              onRemove={onRemove}
              accentClass="border-green-300 bg-green-50/30"
            />
            <BranchSection
              label={t("automationTools.elseBranch")}
              containerId={branchContainerId(nodeId, BRANCH_ELSE)}
              nodes={node.else}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onUpdate={onUpdate}
              onRemove={onRemove}
              accentClass="border-red-300 bg-red-50/30"
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function BranchSection({
  label,
  containerId,
  nodes,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onRemove,
  accentClass,
}: {
  label: string;
  containerId: string;
  nodes: ToolNode[];
  collapsed: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onUpdate: (nodeId: string, updater: (node: ToolNode) => ToolNode) => void;
  onRemove: (nodeId: string) => void;
  accentClass: string;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: containerDropId(containerId),
    data: { type: "container", containerId },
  });

  return (
    <div>
      <Typography.Text strong className="mb-1 block text-xs">
        {label}
      </Typography.Text>
      <div
        ref={setNodeRef}
        className={`min-h-12 rounded border border-dashed p-2 pl-3 ${accentClass} ${
          isOver ? "ring-2 ring-blue-400" : ""
        }`}
      >
        {nodes.length === 0 ? (
          <Typography.Text type="secondary" className="text-xs">
            {t("automationTools.dropHere")}
          </Typography.Text>
        ) : (
          <SortableContext
            items={nodes.map(getNodeId)}
            strategy={verticalListSortingStrategy}
          >
            <NodeContainer
              containerId={containerId}
              nodes={nodes}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function ContainerNodeCard({
  node,
  index,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onRemove,
  accentClass,
  typeLabel,
  loopCount,
}: Props & {
  node: BlockNode | LoopNode;
  accentClass: string;
  typeLabel: "block" | "loop";
  loopCount?: number;
}) {
  const { t } = useTranslation();
  const nodeId = getNodeId(node);
  const isCollapsed = collapsed[nodeId] ?? false;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortableNode(nodeId);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: containerDropId(nodeId),
    data: { type: "container", containerId: nodeId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <Card
        size="small"
        className={`border-l-4 ${accentClass}`}
        title={
          <Space wrap>
            <DragHandle attributes={attributes} listeners={listeners} />
            <IndexBadge>{index + 1}</IndexBadge>
            <span>{t(`automationTools.stepTypes.${typeLabel}`)}</span>
            <Input
              size="small"
              value={node.name ?? ""}
              placeholder={t("automationTools.blockName")}
              className="w-40"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                onUpdate(nodeId, (n) =>
                  isContainerNode(n) ? { ...n, name: e.target.value } : n,
                )
              }
            />
            {typeLabel === "loop" ? (
              <Space size={4}>
                <Typography.Text type="secondary" className="text-xs">
                  {t("automationTools.loopTimes")}
                </Typography.Text>
                <InputNumber
                  size="small"
                  min={1}
                  max={10000}
                  value={loopCount ?? 1}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(v) =>
                    onUpdate(nodeId, (n) =>
                      n.type === "loop" ? { ...n, loopCount: v ?? 1 } : n,
                    )
                  }
                />
              </Space>
            ) : null}
          </Space>
        }
        extra={
          <Space>
            <Button
              size="small"
              type="text"
              icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => onToggleCollapse(nodeId)}
            />
            <Popconfirm
              title={t("automationTools.deleteBlockConfirm")}
              onConfirm={() => onRemove(nodeId)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        }
      >
        {!isCollapsed ? (
          <div
            ref={setDropRef}
            className={`min-h-12 rounded border border-dashed p-2 pl-4 ${
              isOver ? "border-blue-400 bg-blue-50/50" : "border-slate-200"
            }`}
          >
            {node.children.length === 0 ? (
              <Typography.Text type="secondary" className="text-xs">
                {t("automationTools.dropHere")}
              </Typography.Text>
            ) : (
              <SortableContext
                items={node.children.map(getNodeId)}
                strategy={verticalListSortingStrategy}
              >
                <NodeContainer
                  containerId={nodeId}
                  nodes={node.children}
                  collapsed={collapsed}
                  onToggleCollapse={onToggleCollapse}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              </SortableContext>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function IndexBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-blue-100 px-1.5 text-xs font-medium text-blue-700">
      {children}
    </span>
  );
}
