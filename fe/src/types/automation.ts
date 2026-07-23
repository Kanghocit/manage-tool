export type StepType =
  | "goto"
  | "click"
  | "input"
  | "wait"
  | "waitFor"
  | "scroll"
  | "press";

export type BlockType = "block" | "loop" | "if";

export type PaletteType = StepType | BlockType;

export type ConditionKind = "hasElement" | "notHasElement";
export type ConditionMode = "visible" | "exists";

export type Condition = {
  kind: ConditionKind;
  xpath: string;
  mode?: ConditionMode;
  timeoutMs?: number;
};

export type ActionStep =
  | { id?: string; type: "goto"; url: string }
  | { id?: string; type: "click"; xpath: string; timeoutMs?: number }
  | { id?: string; type: "input"; xpath: string; text: string; clearFirst?: boolean }
  | { id?: string; type: "wait"; ms: number }
  | { id?: string; type: "waitFor"; xpath: string; timeoutMs?: number }
  | { id?: string; type: "scroll"; xpath?: string; deltaY?: number }
  | { id?: string; type: "press"; key: string };

export type BlockNode = {
  id?: string;
  type: "block";
  name?: string;
  children: ToolNode[];
};

export type LoopNode = {
  id?: string;
  type: "loop";
  name?: string;
  loopCount: number;
  children: ToolNode[];
};

export type IfNode = {
  id?: string;
  type: "if";
  name?: string;
  condition: Condition;
  then: ToolNode[];
  else: ToolNode[];
};

export type ToolNode = ActionStep | BlockNode | LoopNode | IfNode;

/** @deprecated use ActionStep */
export type AutomationStep = ActionStep;

export const ROOT_CONTAINER_ID = "root";
export const BRANCH_THEN = "then";
export const BRANCH_ELSE = "else";

export type AutomationTool = {
  id: string;
  name: string;
  description?: string | null;
  steps: ToolNode[];
  defaultLoopCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName: string; email: string };
  _count?: { runs: number };
};

export type BrowserProfile = {
  id: string;
  name: string;
  userAgent?: string | null;
  proxyUrl?: string | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SessionStatus = RunStatus;

export type AutomationRunSession = {
  id: string;
  status: SessionStatus;
  currentLoop: number;
  log: string;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  profile: BrowserProfile;
};

export type AutomationRun = {
  id: string;
  toolId: string;
  loopCount: number;
  status: RunStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  tool?: { id: string; name: string; defaultLoopCount?: number };
  sessions?: AutomationRunSession[];
  _count?: { sessions: number };
};

export const STEP_TYPES: StepType[] = [
  "goto",
  "click",
  "input",
  "wait",
  "waitFor",
  "scroll",
  "press",
];

export const BLOCK_TYPES: BlockType[] = ["block", "loop", "if"];

export const PALETTE_TYPES: PaletteType[] = [...STEP_TYPES, ...BLOCK_TYPES];

export function createNodeId(): string {
  return crypto.randomUUID();
}

export function isIfNode(node: ToolNode): node is IfNode {
  return node.type === "if";
}

export function isActionStep(node: ToolNode): node is ActionStep {
  return node.type !== "block" && node.type !== "loop" && node.type !== "if";
}

export function isContainerNode(node: ToolNode): node is BlockNode | LoopNode {
  return node.type === "block" || node.type === "loop";
}

export function getNodeId(node: ToolNode): string {
  return node.id ?? "";
}

export function branchContainerId(ifId: string, branch: typeof BRANCH_THEN | typeof BRANCH_ELSE): string {
  return `${ifId}::${branch}`;
}

export function parseBranchContainerId(
  containerId: string,
): { ifId: string; branch: typeof BRANCH_THEN | typeof BRANCH_ELSE } | null {
  const idx = containerId.indexOf("::");
  if (idx === -1) return null;
  const ifId = containerId.slice(0, idx);
  const branch = containerId.slice(idx + 2);
  if (branch !== BRANCH_THEN && branch !== BRANCH_ELSE) return null;
  return { ifId, branch };
}

function findIfNode(nodes: ToolNode[], ifId: string): IfNode | null {
  for (const node of nodes) {
    if (isIfNode(node) && getNodeId(node) === ifId) return node;
    if (isContainerNode(node)) {
      const found = findIfNode(node.children, ifId);
      if (found) return found;
    }
    if (isIfNode(node)) {
      const inThen = findIfNode(node.then, ifId);
      if (inThen) return inThen;
      const inElse = findIfNode(node.else, ifId);
      if (inElse) return inElse;
    }
  }
  return null;
}

export function createDefaultStep(type: StepType): ActionStep {
  const id = createNodeId();
  switch (type) {
    case "goto":
      return { id, type: "goto", url: "https://" };
    case "click":
      return { id, type: "click", xpath: "", timeoutMs: 30000 };
    case "input":
      return { id, type: "input", xpath: "", text: "", clearFirst: true };
    case "wait":
      return { id, type: "wait", ms: 1000 };
    case "waitFor":
      return { id, type: "waitFor", xpath: "", timeoutMs: 30000 };
    case "scroll":
      return { id, type: "scroll", deltaY: 300 };
    case "press":
      return { id, type: "press", key: "Enter" };
    default:
      return { id, type: "wait", ms: 1000 };
  }
}

export function createDefaultBlock(name = "Block"): BlockNode {
  return {
    id: createNodeId(),
    type: "block",
    name,
    children: [],
  };
}

export function createDefaultLoop(name = "Loop", loopCount = 3): LoopNode {
  return {
    id: createNodeId(),
    type: "loop",
    name,
    loopCount,
    children: [],
  };
}

export function createDefaultIf(name = "If"): IfNode {
  return {
    id: createNodeId(),
    type: "if",
    name,
    condition: {
      kind: "hasElement",
      xpath: "",
      mode: "visible",
      timeoutMs: 3000,
    },
    then: [],
    else: [],
  };
}

export function createPaletteNode(type: PaletteType): ToolNode {
  if (type === "block") return createDefaultBlock();
  if (type === "loop") return createDefaultLoop();
  if (type === "if") return createDefaultIf();
  return createDefaultStep(type);
}

function cloneNode(node: ToolNode): ToolNode {
  if (isContainerNode(node)) {
    return { ...node, children: cloneNodes(node.children) };
  }
  if (isIfNode(node)) {
    return {
      ...node,
      then: cloneNodes(node.then),
      else: cloneNodes(node.else),
    };
  }
  return { ...node };
}

function cloneNodes(nodes: ToolNode[]): ToolNode[] {
  return nodes.map(cloneNode);
}

export function ensureNodeIds(nodes: ToolNode[]): ToolNode[] {
  return nodes.map((node) => {
    if (isContainerNode(node)) {
      return {
        ...node,
        id: node.id ?? createNodeId(),
        children: ensureNodeIds(node.children),
      };
    }
    if (isIfNode(node)) {
      return {
        ...node,
        id: node.id ?? createNodeId(),
        then: ensureNodeIds(node.then),
        else: ensureNodeIds(node.else),
      };
    }
    return { ...node, id: node.id ?? createNodeId() };
  });
}

export type NodeLocation = {
  containerId: string;
  index: number;
  node: ToolNode;
};

function walkAllContainers(
  nodes: ToolNode[],
  containerId: string,
  visitor: (items: ToolNode[], containerId: string) => void,
): void {
  visitor(nodes, containerId);
  for (const node of nodes) {
    if (isContainerNode(node)) {
      walkAllContainers(node.children, getNodeId(node), visitor);
    }
    if (isIfNode(node)) {
      const id = getNodeId(node);
      walkAllContainers(node.then, branchContainerId(id, BRANCH_THEN), visitor);
      walkAllContainers(node.else, branchContainerId(id, BRANCH_ELSE), visitor);
    }
  }
}

export function findNodeLocation(
  nodes: ToolNode[],
  nodeId: string,
  containerId = ROOT_CONTAINER_ID,
): NodeLocation | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const id = getNodeId(node);
    if (id === nodeId) {
      return { containerId, index: i, node };
    }
    if (isContainerNode(node)) {
      const found = findNodeLocation(node.children, nodeId, id);
      if (found) return found;
    }
    if (isIfNode(node)) {
      const ifId = getNodeId(node);
      const inThen = findNodeLocation(
        node.then,
        nodeId,
        branchContainerId(ifId, BRANCH_THEN),
      );
      if (inThen) return inThen;
      const inElse = findNodeLocation(
        node.else,
        nodeId,
        branchContainerId(ifId, BRANCH_ELSE),
      );
      if (inElse) return inElse;
    }
  }
  return null;
}

export function getContainerChildren(
  nodes: ToolNode[],
  containerId: string,
): ToolNode[] | null {
  if (containerId === ROOT_CONTAINER_ID) return nodes;

  const branch = parseBranchContainerId(containerId);
  if (branch) {
    const ifNode = findIfNode(nodes, branch.ifId);
    if (!ifNode) return null;
    return branch.branch === BRANCH_THEN ? ifNode.then : ifNode.else;
  }

  const loc = findNodeLocation(nodes, containerId);
  if (!loc || !isContainerNode(loc.node)) return null;
  return loc.node.children;
}

function walkDescendants(items: ToolNode[], targetId: string): boolean {
  for (const item of items) {
    if (getNodeId(item) === targetId) return true;
    if (isContainerNode(item) && walkDescendants(item.children, targetId)) {
      return true;
    }
    if (isIfNode(item)) {
      if (
        walkDescendants(item.then, targetId) ||
        walkDescendants(item.else, targetId)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function isDescendant(
  nodes: ToolNode[],
  ancestorId: string,
  targetId: string,
): boolean {
  const branch = parseBranchContainerId(targetId);
  if (branch) {
    if (branch.ifId === ancestorId) return true;
    return isDescendant(nodes, ancestorId, branch.ifId);
  }

  if (targetId === ancestorId) return true;

  const ancestorLoc = findNodeLocation(nodes, ancestorId);
  if (!ancestorLoc) return false;

  const { node } = ancestorLoc;
  if (isContainerNode(node)) {
    return walkDescendants(node.children, targetId);
  }
  if (isIfNode(node)) {
    return (
      walkDescendants(node.then, targetId) ||
      walkDescendants(node.else, targetId)
    );
  }
  return false;
}

function setIfBranch(
  nodes: ToolNode[],
  ifId: string,
  branch: typeof BRANCH_THEN | typeof BRANCH_ELSE,
  children: ToolNode[],
): ToolNode[] {
  return nodes.map((node) => {
    if (isIfNode(node) && getNodeId(node) === ifId) {
      return branch === BRANCH_THEN
        ? { ...node, then: children }
        : { ...node, else: children };
    }
    if (isContainerNode(node)) {
      return {
        ...node,
        children: setIfBranch(node.children, ifId, branch, children),
      };
    }
    if (isIfNode(node)) {
      return {
        ...node,
        then: setIfBranch(node.then, ifId, branch, children),
        else: setIfBranch(node.else, ifId, branch, children),
      };
    }
    return node;
  });
}

function setContainerChildren(
  nodes: ToolNode[],
  containerId: string,
  children: ToolNode[],
): ToolNode[] {
  if (containerId === ROOT_CONTAINER_ID) return children;

  const branch = parseBranchContainerId(containerId);
  if (branch) {
    return setIfBranch(nodes, branch.ifId, branch.branch, children);
  }

  return nodes.map((node) => {
    if (isContainerNode(node) && getNodeId(node) === containerId) {
      return { ...node, children };
    }
    if (isContainerNode(node)) {
      return {
        ...node,
        children: setContainerChildren(node.children, containerId, children),
      };
    }
    if (isIfNode(node)) {
      return {
        ...node,
        then: setContainerChildren(node.then, containerId, children),
        else: setContainerChildren(node.else, containerId, children),
      };
    }
    return node;
  });
}

export function insertNode(
  nodes: ToolNode[],
  containerId: string,
  index: number,
  node: ToolNode,
): ToolNode[] {
  const next = cloneNodes(nodes);
  const children = getContainerChildren(next, containerId);
  if (!children) return next;
  const updated = [...children];
  updated.splice(index, 0, node);
  return setContainerChildren(next, containerId, updated);
}

export function removeNode(nodes: ToolNode[], nodeId: string): ToolNode[] {
  const loc = findNodeLocation(nodes, nodeId);
  if (!loc) return nodes;

  const next = cloneNodes(nodes);
  const children = getContainerChildren(next, loc.containerId);
  if (!children) return next;
  const updated = children.filter((_, i) => i !== loc.index);
  return setContainerChildren(next, loc.containerId, updated);
}

export function moveNode(
  nodes: ToolNode[],
  activeId: string,
  overContainerId: string,
  overIndex: number,
): ToolNode[] {
  const activeLoc = findNodeLocation(nodes, activeId);
  if (!activeLoc) return nodes;

  if (activeId === overContainerId) return nodes;
  if (isDescendant(nodes, activeId, overContainerId)) return nodes;

  let next = cloneNodes(nodes);
  const sourceChildren = getContainerChildren(next, activeLoc.containerId);
  if (!sourceChildren) return nodes;

  const [moved] = sourceChildren.splice(activeLoc.index, 1);
  next = setContainerChildren(next, activeLoc.containerId, [...sourceChildren]);

  let targetIndex = overIndex;
  if (
    activeLoc.containerId === overContainerId &&
    activeLoc.index < overIndex
  ) {
    targetIndex -= 1;
  }

  const targetChildren = getContainerChildren(next, overContainerId) ?? [];
  const updatedTarget = [...targetChildren];
  updatedTarget.splice(targetIndex, 0, moved);
  return setContainerChildren(next, overContainerId, updatedTarget);
}

function mapNodes(
  nodes: ToolNode[],
  mapper: (node: ToolNode) => ToolNode,
): ToolNode[] {
  return nodes.map((node) => {
    const mapped = mapper(node);
    if (isContainerNode(mapped)) {
      return { ...mapped, children: mapNodes(mapped.children, mapper) };
    }
    if (isIfNode(mapped)) {
      return {
        ...mapped,
        then: mapNodes(mapped.then, mapper),
        else: mapNodes(mapped.else, mapper),
      };
    }
    return mapped;
  });
}

export function updateNode(
  nodes: ToolNode[],
  nodeId: string,
  updater: (node: ToolNode) => ToolNode,
): ToolNode[] {
  return mapNodes(nodes, (node) =>
    getNodeId(node) === nodeId ? updater(node) : node,
  );
}

export function collectContainerIds(nodes: ToolNode[]): string[] {
  const ids: string[] = [ROOT_CONTAINER_ID];
  walkAllContainers(nodes, ROOT_CONTAINER_ID, (items, containerId) => {
    if (containerId !== ROOT_CONTAINER_ID) ids.push(containerId);
    for (const node of items) {
      if (isIfNode(node)) {
        const ifId = getNodeId(node);
        ids.push(branchContainerId(ifId, BRANCH_THEN));
        ids.push(branchContainerId(ifId, BRANCH_ELSE));
      }
    }
  });
  return [...new Set(ids)];
}

function walkSortable(nodes: ToolNode[], ids: string[]): void {
  for (const node of nodes) {
    ids.push(getNodeId(node));
    if (isContainerNode(node)) walkSortable(node.children, ids);
    if (isIfNode(node)) {
      walkSortable(node.then, ids);
      walkSortable(node.else, ids);
    }
  }
}

export function collectSortableIds(nodes: ToolNode[]): string[] {
  const ids: string[] = [];
  walkSortable(nodes, ids);
  return ids;
}

export function countAllNodes(nodes: ToolNode[]): number {
  let total = 0;
  const walk = (items: ToolNode[]) => {
    for (const node of items) {
      total += 1;
      if (isContainerNode(node)) walk(node.children);
      if (isIfNode(node)) {
        walk(node.then);
        walk(node.else);
      }
    }
  };
  walk(nodes);
  return total;
}

export function paletteDragId(type: PaletteType): string {
  return `palette:${type}`;
}

export function parsePaletteDragId(id: string): PaletteType | null {
  if (!id.startsWith("palette:")) return null;
  return id.slice("palette:".length) as PaletteType;
}

export function containerDropId(containerId: string): string {
  return `container:${containerId}`;
}

export function parseContainerDropId(id: string): string | null {
  if (!id.startsWith("container:")) return null;
  return id.slice("container:".length);
}
