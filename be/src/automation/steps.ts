import { z } from "zod";

const timeoutMsSchema = z.number().int().min(100).max(120_000).optional();
const nodeIdSchema = z.string().max(100).optional();

export const MAX_NODE_DEPTH = 5;
export const MAX_NODE_COUNT = 300;

export const gotoStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("goto"),
  url: z.string().url().max(2000),
});

export const clickStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("click"),
  xpath: z.string().min(1).max(2000),
  timeoutMs: timeoutMsSchema,
});

export const inputStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("input"),
  xpath: z.string().min(1).max(2000),
  text: z.string().max(5000),
  clearFirst: z.boolean().optional(),
});

export const waitStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("wait"),
  ms: z.number().int().min(0).max(300_000),
});

export const waitForStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("waitFor"),
  xpath: z.string().min(1).max(2000),
  timeoutMs: timeoutMsSchema,
});

export const scrollStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("scroll"),
  xpath: z.string().min(1).max(2000).optional(),
  deltaY: z.number().int().min(-10_000).max(10_000).optional(),
});

export const pressStepSchema = z.object({
  id: nodeIdSchema,
  type: z.literal("press"),
  key: z.string().min(1).max(50),
});

export const actionStepSchema = z.discriminatedUnion("type", [
  gotoStepSchema,
  clickStepSchema,
  inputStepSchema,
  waitStepSchema,
  waitForStepSchema,
  scrollStepSchema,
  pressStepSchema,
]);

/** @deprecated use actionStepSchema */
export const stepSchema = actionStepSchema;

export type ActionStep = z.infer<typeof actionStepSchema>;
/** @deprecated use ActionStep */
export type AutomationStep = ActionStep;

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

export type ConditionKind = "hasElement" | "notHasElement";
export type ConditionMode = "visible" | "exists";

export type Condition = {
  kind: ConditionKind;
  xpath: string;
  mode?: ConditionMode;
  timeoutMs?: number;
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

export const conditionSchema = z.object({
  kind: z.enum(["hasElement", "notHasElement"]),
  xpath: z.string().min(1).max(2000),
  mode: z.enum(["visible", "exists"]).default("visible"),
  timeoutMs: z.number().int().min(100).max(120_000).default(3000),
});

export const blockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.object({
    id: nodeIdSchema,
    type: z.literal("block"),
    name: z.string().max(200).optional(),
    children: z.array(nodeSchema),
  }),
);

export const loopNodeSchema: z.ZodType<LoopNode> = z.lazy(() =>
  z.object({
    id: nodeIdSchema,
    type: z.literal("loop"),
    name: z.string().max(200).optional(),
    loopCount: z.number().int().min(1).max(10_000),
    children: z.array(nodeSchema),
  }),
);

export const ifNodeSchema: z.ZodType<IfNode> = z.lazy(() =>
  z.object({
    id: nodeIdSchema,
    type: z.literal("if"),
    name: z.string().max(200).optional(),
    condition: conditionSchema,
    then: z.array(nodeSchema),
    else: z.array(nodeSchema),
  }),
);

export const nodeSchema: z.ZodType<ToolNode> = z.lazy(() =>
  z.union([actionStepSchema, blockNodeSchema, loopNodeSchema, ifNodeSchema]),
);

function analyzeTree(nodes: ToolNode[]): { count: number; maxDepth: number } {
  let count = 0;
  let maxDepth = 0;

  const walk = (items: ToolNode[], depth: number) => {
    maxDepth = Math.max(maxDepth, depth);
    for (const node of items) {
      count += 1;
      if (node.type === "block" || node.type === "loop") {
        walk(node.children, depth + 1);
      } else if (node.type === "if") {
        walk(node.then, depth + 1);
        walk(node.else, depth + 1);
      }
    }
  };

  walk(nodes, 1);
  return { count, maxDepth };
}

export const stepsSchema = z
  .array(nodeSchema)
  .min(1)
  .superRefine((nodes, ctx) => {
    const { count, maxDepth } = analyzeTree(nodes);
    if (count > MAX_NODE_COUNT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Too many nodes (max ${MAX_NODE_COUNT}).`,
      });
    }
    if (maxDepth > MAX_NODE_DEPTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tree too deep (max ${MAX_NODE_DEPTH} levels).`,
      });
    }
  });

export function isIfNode(node: ToolNode): node is IfNode {
  return node.type === "if";
}

export function isActionStep(node: ToolNode): node is ActionStep {
  return (
    node.type !== "block" &&
    node.type !== "loop" &&
    node.type !== "if"
  );
}

export function describeActionStep(step: ActionStep): string {
  switch (step.type) {
    case "goto":
      return `Go to ${step.url}`;
    case "click":
      return `Click ${step.xpath}`;
    case "input":
      return `Input into ${step.xpath}`;
    case "wait":
      return `Wait ${step.ms}ms`;
    case "waitFor":
      return `Wait for ${step.xpath}`;
    case "scroll":
      return step.xpath ? `Scroll to ${step.xpath}` : `Scroll by ${step.deltaY ?? 0}px`;
    case "press":
      return `Press ${step.key}`;
    default:
      return "Unknown step";
  }
}

export function describeCondition(condition: Condition): string {
  return `${condition.kind} ${condition.xpath} (${condition.mode ?? "visible"})`;
}

export function describeNode(node: ToolNode): string {
  if (isActionStep(node)) return describeActionStep(node);
  if (node.type === "block") {
    return `Block${node.name ? ` "${node.name}"` : ""} (${node.children.length} items)`;
  }
  if (node.type === "loop") {
    return `Loop${node.name ? ` "${node.name}"` : ""} x${node.loopCount} (${node.children.length} items)`;
  }
  return `If ${describeCondition(node.condition)} (then: ${node.then.length}, else: ${node.else.length})`;
}

/** @deprecated use describeActionStep */
export function describeStep(step: ActionStep): string {
  return describeActionStep(step);
}
