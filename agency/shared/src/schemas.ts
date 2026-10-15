import { z } from 'zod';

import { DEPARTMENT_IDS } from './departments.js';

/**
 * Typed contracts shared by the backend, the app (Android + Web) and the
 * desktop bridge. Every payload that crosses a process boundary is validated
 * with these schemas on the receiving side.
 */

export const IdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/, 'id must be alphanumeric, "_" or "-"');

export const IsoDateSchema = z.string().min(10);

// ── Agent activity (operational state shown by the character) ──────────────

/**
 * Operational states. They are ALWAYS derived from real backend events;
 * decorative wandering never sets one of these.
 */
export const AGENT_ACTIVITY_STATES = [
  'offline',
  'idle',
  'planning',
  'reading',
  'coding',
  'running_command',
  'testing',
  'reviewing',
  'awaiting_approval',
  'done',
  'failed',
] as const;
export const AgentActivityStateSchema = z.enum(AGENT_ACTIVITY_STATES);
export type AgentActivityState = z.infer<typeof AgentActivityStateSchema>;

// ── Agents ──────────────────────────────────────────────────────────────────

export const DepartmentIdSchema = z.enum(DEPARTMENT_IDS);

export const AgentSourceSchema = z.enum(['template', 'imported', 'custom']);
export type AgentSource = z.infer<typeof AgentSourceSchema>;

/** Autonomy decides which tool calls need a human approval in the app. */
export const AutonomySchema = z.enum([
  /** Read-only: any write or command needs approval. */
  'supervised',
  /** Edits inside the workspace are free; commands outside the safe list need approval. */
  'standard',
  /** Everything allowed by policy runs; only sensitive operations ask. */
  'autonomous',
]);
export type Autonomy = z.infer<typeof AutonomySchema>;

export const AgentProfileSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60),
  role: z.string().max(120),
  department: DepartmentIdSchema,
  description: z.string().max(2000).default(''),
  responsibilities: z.array(z.string().max(300)).max(30).default([]),
  /** Persona/system instructions appended to the Claude Code preset prompt. */
  instructions: z.string().max(20000).default(''),
  /** Claude model id; undefined = backend default. */
  model: z.string().max(80).optional(),
  /** Allowed tool names (Claude Code tool names); empty = backend default set. */
  tools: z.array(z.string().max(80)).max(60).default([]),
  autonomy: AutonomySchema.default('standard'),
  enabled: z.boolean().default(true),
  /** Character skin 0-5 and hue shift (degrees). */
  palette: z.number().int().min(0).max(5).default(0),
  hueShift: z.number().int().min(0).max(359).default(0),
  /** Default project for chats/missions. */
  projectId: IdSchema.optional(),
  source: AgentSourceSchema.default('custom'),
  /** For templates: an explicit note that this is NOT a copy of a local agent. */
  sourceNote: z.string().max(500).optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

export const AgentInputSchema = AgentProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({ id: IdSchema.optional() });
export type AgentInput = z.input<typeof AgentInputSchema>;

export const AgentPatchSchema = AgentInputSchema.partial().omit({ id: true });
export type AgentPatch = z.input<typeof AgentPatchSchema>;

/** Live, derived state of an agent (never persisted as truth). */
export const AgentRuntimeStateSchema = z.object({
  agentId: IdSchema,
  activity: AgentActivityStateSchema,
  /** Human readable status ("Reading payments.ts"). */
  statusText: z.string().max(300).default(''),
  missionId: IdSchema.optional(),
  projectId: IdSchema.optional(),
  /** Tool currently running, Claude tool name. */
  toolName: z.string().optional(),
  updatedAt: IsoDateSchema,
  /** True when produced by DEMO mode — never real work. */
  demo: z.boolean().default(false),
});
export type AgentRuntimeState = z.infer<typeof AgentRuntimeStateSchema>;

// ── Projects & branding ─────────────────────────────────────────────────────

export const RepoRefSchema = z.object({
  provider: z.literal('github'),
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/),
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/),
  defaultBranch: z.string().max(200).default('main'),
});
export type RepoRef = z.infer<typeof RepoRefSchema>;

export const ProjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(80),
  description: z.string().max(2000).default(''),
  repo: RepoRefSchema.optional(),
  /** Public/staging URL used for previews ("open original interface"). */
  appUrl: z.string().url().optional(),
  /** Agents assigned to the project team. */
  team: z.array(IdSchema).default([]),
  /** Missions may only run when the project is explicitly authorized. */
  authorized: z.boolean().default(false),
  archived: z.boolean().default(false),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectInputSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({ id: IdSchema.optional() });
export type ProjectInput = z.input<typeof ProjectInputSchema>;

export const BrandAssetKindSchema = z.enum([
  'logo',
  'icon',
  'favicon',
  'banner',
  'screenshot',
  'image',
]);

export const BrandAssetSchema = z.object({
  /** Path relative to the repository root. */
  path: z.string().max(500),
  kind: BrandAssetKindSchema,
  /** 0..1 likelihood that this is the main logo. */
  score: z.number().min(0).max(1),
  bytes: z.number().int().nonnegative(),
  mime: z.string().max(80),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Id in the backend asset cache, served at /api/assets/:assetId. */
  assetId: z.string().max(120).optional(),
  /** Short-lived signed URL added by the backend when responding. */
  url: z.string().optional(),
});
export type BrandAsset = z.infer<typeof BrandAssetSchema>;

export const BrandColorSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Where it came from: "--primary in src/index.css", "tailwind theme.colors.brand". */
  source: z.string().max(300),
  role: z.enum(['primary', 'secondary', 'accent', 'background', 'text', 'other']),
  occurrences: z.number().int().nonnegative(),
});
export type BrandColor = z.infer<typeof BrandColorSchema>;

export const ProjectBrandingSchema = z.object({
  projectId: IdSchema,
  /** Commit the extraction ran against (cache key). */
  commitSha: z.string().max(64).optional(),
  extractedAt: IsoDateSchema,
  logoCandidates: z.array(BrandAssetSchema).max(40),
  /** Chosen by the user when several candidates exist; else best score. */
  selectedLogoPath: z.string().max(500).optional(),
  selectedByUser: z.boolean().default(false),
  colors: z.array(BrandColorSchema).max(40),
  fonts: z.array(z.object({ family: z.string().max(120), source: z.string().max(300) })).max(20),
  /** Files that contributed (css, tailwind config, manifest...). */
  sourceFiles: z.array(z.string().max(500)).max(100),
  /** Theme derived for the app (accent etc.). */
  theme: z.object({
    primary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
  status: z.enum(['ok', 'empty', 'error']),
  error: z.string().max(1000).optional(),
});
export type ProjectBranding = z.infer<typeof ProjectBrandingSchema>;

export const PreviewSourceSchema = z.enum(['repo', 'capture', 'upload']);

export const ProjectPreviewSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string().max(120),
  /** Where the image is genuinely from — never a generated mockup. */
  source: PreviewSourceSchema,
  /** Repo path, captured URL, or original filename. */
  origin: z.string().max(1000),
  assetId: z.string().max(120),
  mime: z.string().max(80),
  bytes: z.number().int().nonnegative(),
  agentId: IdSchema.optional(),
  missionId: IdSchema.optional(),
  createdAt: IsoDateSchema,
  /** Commit the image was found/captured at, for staleness detection. */
  commitSha: z.string().max(64).optional(),
  /** Short-lived signed URL added by the backend when responding. */
  url: z.string().optional(),
});
export type ProjectPreview = z.infer<typeof ProjectPreviewSchema>;

// ── Missions (tasks) ────────────────────────────────────────────────────────

export const MISSION_STATUSES = [
  'backlog',
  'queued',
  'running',
  'awaiting_approval',
  'testing',
  'done',
  'failed',
  'cancelled',
] as const;
export const MissionStatusSchema = z.enum(MISSION_STATUSES);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

export const MissionKindSchema = z.enum(['task', 'chat']);

export const UsageTotalsSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheCreationTokens: z.number().int().nonnegative().default(0),
  /** USD as reported by the Claude Agent SDK (a local estimate, not a bill). */
  costUsd: z.number().nonnegative().default(0),
});
export type UsageTotals = z.infer<typeof UsageTotalsSchema>;

export const MissionSchema = z.object({
  id: IdSchema,
  kind: MissionKindSchema.default('task'),
  title: z.string().min(1).max(200),
  objective: z.string().min(1).max(20000),
  projectId: IdSchema,
  agentId: IdSchema,
  status: MissionStatusSchema,
  /** Claude Agent SDK session id — lets a chat or an interrupted mission resume. */
  sessionId: z.string().max(120).optional(),
  /** Git branch created for the mission inside its isolated workspace. */
  branch: z.string().max(200).optional(),
  baseCommit: z.string().max(64).optional(),
  /** Final report produced by the agent. */
  result: z.string().max(200000).optional(),
  error: z.string().max(5000).optional(),
  /** Unified diff summary of the workspace at completion. */
  diffStat: z.string().max(20000).optional(),
  usage: UsageTotalsSchema.default({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
  }),
  model: z.string().max(80).optional(),
  numTurns: z.number().int().nonnegative().optional(),
  createdBy: z.string().max(120).default('app'),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  startedAt: IsoDateSchema.optional(),
  finishedAt: IsoDateSchema.optional(),
  demo: z.boolean().default(false),
});
export type Mission = z.infer<typeof MissionSchema>;

export const MissionCreateSchema = z.object({
  title: z.string().min(1).max(200),
  objective: z.string().min(1).max(20000),
  projectId: IdSchema,
  agentId: IdSchema,
  /** false = goes to backlog instead of the run queue. */
  start: z.boolean().default(true),
});
export type MissionCreate = z.input<typeof MissionCreateSchema>;

// ── Mission events (the append-only execution log) ──────────────────────────

export const MissionEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('status'),
    status: MissionStatusSchema,
    note: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('activity'),
    activity: AgentActivityStateSchema,
    statusText: z.string().max(300),
  }),
  z.object({
    kind: z.literal('tool_start'),
    toolUseId: z.string().max(120),
    toolName: z.string().max(120),
    statusText: z.string().max(300),
    input: z.unknown().optional(),
  }),
  z.object({
    kind: z.literal('tool_end'),
    toolUseId: z.string().max(120),
    toolName: z.string().max(120).optional(),
    isError: z.boolean().default(false),
    /** Truncated tool output for evidence. */
    output: z.string().max(20000).optional(),
  }),
  z.object({
    kind: z.literal('text'),
    /** Assistant text (final or partial when streaming). */
    text: z.string().max(200000),
    partial: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal('approval_requested'),
    approvalId: IdSchema,
    toolName: z.string().max(120),
    summary: z.string().max(2000),
  }),
  z.object({
    kind: z.literal('approval_resolved'),
    approvalId: IdSchema,
    decision: z.enum(['approved', 'denied', 'expired']),
  }),
  z.object({
    kind: z.literal('usage'),
    usage: UsageTotalsSchema,
    model: z.string().max(80).optional(),
  }),
  z.object({
    kind: z.literal('log'),
    level: z.enum(['info', 'warn', 'error']),
    message: z.string().max(5000),
  }),
  z.object({
    kind: z.literal('result'),
    text: z.string().max(200000),
    isError: z.boolean(),
  }),
]);
export type MissionEventBody = z.infer<typeof MissionEventSchema>;

export type MissionEvent = MissionEventBody & {
  seq: number;
  missionId: string;
  agentId: string;
  ts: string;
  demo?: boolean;
};

// ── Chat ────────────────────────────────────────────────────────────────────

export const ChatRoleSchema = z.enum(['user', 'agent', 'system']);

export const ChatMessageSchema = z.object({
  id: IdSchema,
  agentId: IdSchema,
  /** Each chat turn runs as a `chat` mission so it is observable like any task. */
  missionId: IdSchema.optional(),
  projectId: IdSchema.optional(),
  role: ChatRoleSchema,
  text: z.string().max(200000),
  /** True while the agent is still streaming this message. */
  streaming: z.boolean().default(false),
  ts: IsoDateSchema,
  demo: z.boolean().default(false),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSendSchema = z.object({
  text: z.string().min(1).max(20000),
  projectId: IdSchema.optional(),
  /** Start a fresh Claude session instead of resuming the last one. */
  newSession: z.boolean().default(false),
});
export type ChatSend = z.input<typeof ChatSendSchema>;

// ── Approvals ───────────────────────────────────────────────────────────────

export const ApprovalSchema = z.object({
  id: IdSchema,
  missionId: IdSchema,
  agentId: IdSchema,
  projectId: IdSchema,
  toolName: z.string().max(120),
  /** Redacted, truncated tool input for display. */
  input: z.unknown(),
  summary: z.string().max(2000),
  reason: z.string().max(1000),
  risk: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'approved', 'denied', 'expired']),
  createdAt: IsoDateSchema,
  resolvedAt: IsoDateSchema.optional(),
  resolvedBy: z.string().max(120).optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const ApprovalDecisionSchema = z.object({
  decision: z.enum(['approve', 'deny']),
  note: z.string().max(1000).optional(),
});

// ── Usage ───────────────────────────────────────────────────────────────────

export const UsageRecordSchema = z.object({
  id: IdSchema,
  missionId: IdSchema,
  agentId: IdSchema,
  projectId: IdSchema,
  model: z.string().max(80),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  /** Origin of the cost number, always shown next to it. */
  costSource: z.enum(['agent_sdk_estimate', 'admin_cost_report']),
  ts: IsoDateSchema,
});
export type UsageRecord = z.infer<typeof UsageRecordSchema>;

const LimitWindowSchema = z.object({
  usedPercent: z.number().min(0).max(100),
  resetsAt: IsoDateSchema.optional(),
});

/**
 * Subscription (claude.ai Pro/Max) limits. The ONLY documented source is the
 * Claude Code statusline JSON (`rate_limits.five_hour|seven_day`), which only
 * the Desktop Bridge can read. The cloud backend reports `available: false`.
 */
export const SubscriptionLimitsSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(false),
    reason: z.string().max(500),
  }),
  z.object({
    available: z.literal(true),
    source: z.literal('claude_code_statusline'),
    observedAt: IsoDateSchema,
    session: LimitWindowSchema.optional(),
    weekly: LimitWindowSchema.optional(),
  }),
]);
export type SubscriptionLimits = z.infer<typeof SubscriptionLimitsSchema>;

export const UsageGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  totals: UsageTotalsSchema,
  missions: z.number().int().nonnegative(),
});
export type UsageGroup = z.infer<typeof UsageGroupSchema>;

export const OrgCostSchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(false), reason: z.string() }),
  z.object({
    available: z.literal(true),
    source: z.literal('admin_cost_report'),
    periodStart: IsoDateSchema,
    periodEnd: IsoDateSchema,
    totalUsd: z.number(),
    fetchedAt: IsoDateSchema,
  }),
]);
export type OrgCost = z.infer<typeof OrgCostSchema>;

export const UsageSummarySchema = z.object({
  generatedAt: IsoDateSchema,
  limits: SubscriptionLimitsSchema,
  /** Prepaid credit balance: no official API exists, always unavailable. */
  credits: z.object({ available: z.literal(false), reason: z.string() }),
  orgCost: OrgCostSchema,
  totals: UsageTotalsSchema,
  byAgent: z.array(UsageGroupSchema),
  byProject: z.array(UsageGroupSchema),
  byModel: z.array(UsageGroupSchema),
  byMission: z.array(UsageGroupSchema),
  recent: z.array(UsageRecordSchema),
});
export type UsageSummary = z.infer<typeof UsageSummarySchema>;

export const UsageAlertRuleSchema = z.object({
  id: IdSchema,
  metric: z.enum(['session_percent', 'weekly_percent', 'cost_usd_day', 'cost_usd_month']),
  threshold: z.number().positive(),
  enabled: z.boolean().default(true),
});
export type UsageAlertRule = z.infer<typeof UsageAlertRuleSchema>;

export const UsageAlertSchema = z.object({
  id: IdSchema,
  ruleId: IdSchema,
  metric: UsageAlertRuleSchema.shape.metric,
  value: z.number(),
  threshold: z.number(),
  message: z.string(),
  ts: IsoDateSchema,
});
export type UsageAlert = z.infer<typeof UsageAlertSchema>;

// ── Capabilities (what this backend can really do right now) ───────────────

export const CapabilitiesSchema = z.object({
  version: z.string(),
  mode: z.enum(['cloud', 'demo']),
  executor: z.object({
    kind: z.enum(['claude_agent_sdk', 'demo', 'unavailable']),
    ready: z.boolean(),
    reason: z.string().optional(),
    defaultModel: z.string(),
  }),
  github: z.object({ configured: z.boolean() }),
  usage: z.object({
    agentTokens: z.boolean(),
    subscriptionLimits: z.boolean(),
    orgCost: z.boolean(),
    credits: z.literal(false),
  }),
  previews: z.object({ capture: z.boolean() }),
  desktopBridge: z.object({ connected: z.boolean(), lastSeenAt: IsoDateSchema.optional() }),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const AuditEntrySchema = z.object({
  ts: IsoDateSchema,
  actor: z.string(),
  action: z.string(),
  target: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  ip: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
