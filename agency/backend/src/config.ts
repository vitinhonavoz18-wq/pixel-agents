import * as path from 'node:path';

/**
 * Backend configuration — ONLY from environment variables. Secrets never live
 * in code, in the app bundle or in the repository (see agency/backend/.env.example).
 */
export interface AgencyConfig {
  host: string;
  port: number;
  dataDir: string;
  workspacesDir: string;
  /** Bootstrap admin token (hashed into tokens.json on first boot). */
  adminToken?: string;
  anthropicConfigured: boolean;
  defaultModel: string;
  githubToken?: string;
  anthropicAdminKey?: string;
  maxConcurrentMissions: number;
  maxTurns: number;
  maxBudgetUsd?: number;
  missionTimeoutMs: number;
  approvalTimeoutMs: number;
  demoMode: boolean;
  corsOrigins: string[] | true;
  rateLimitPerMinute: number;
  /** Optional owner allowlist for GitHub repos ("owner1,owner2"). */
  allowedRepoOwners: string[];
  /** Signing key for short-lived asset URLs. */
  assetSigningKey: string;
  enableCapture: boolean;
}

function num(v: string | undefined, d: number): number {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

function list(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgencyConfig {
  const dataDir = path.resolve(env.AGENCY_DATA_DIR ?? './data');
  const cors = list(env.AGENCY_CORS_ORIGINS);
  return {
    host: env.AGENCY_HOST ?? '0.0.0.0',
    port: num(env.PORT ?? env.AGENCY_PORT, 8787),
    dataDir,
    workspacesDir: path.resolve(env.AGENCY_WORKSPACES_DIR ?? path.join(dataDir, 'workspaces')),
    adminToken: env.AGENCY_ADMIN_TOKEN || undefined,
    // The Agent SDK authenticates with an API key or a cloud provider (Bedrock,
    // Vertex, Foundry). claude.ai subscription login is NOT allowed for
    // third-party products (Agent SDK docs), so it is never used here.
    anthropicConfigured: Boolean(
      env.ANTHROPIC_API_KEY ||
      env.CLAUDE_CODE_USE_BEDROCK === '1' ||
      env.CLAUDE_CODE_USE_VERTEX === '1' ||
      env.CLAUDE_CODE_USE_FOUNDRY === '1',
    ),
    defaultModel: env.AGENCY_DEFAULT_MODEL ?? 'claude-opus-5-5',
    githubToken: env.AGENCY_GITHUB_TOKEN || undefined,
    anthropicAdminKey: env.ANTHROPIC_ADMIN_KEY || undefined,
    maxConcurrentMissions: Math.max(1, num(env.AGENCY_MAX_CONCURRENT_MISSIONS, 2)),
    maxTurns: Math.max(1, num(env.AGENCY_MAX_TURNS, 80)),
    maxBudgetUsd: env.AGENCY_MAX_BUDGET_USD ? num(env.AGENCY_MAX_BUDGET_USD, 5) : undefined,
    missionTimeoutMs: num(env.AGENCY_MISSION_TIMEOUT_MIN, 45) * 60_000,
    approvalTimeoutMs: num(env.AGENCY_APPROVAL_TIMEOUT_MIN, 30) * 60_000,
    demoMode: env.AGENCY_DEMO_MODE === '1',
    corsOrigins: cors.length > 0 ? cors : true,
    rateLimitPerMinute: Math.max(10, num(env.AGENCY_RATE_LIMIT_PER_MIN, 240)),
    allowedRepoOwners: list(env.AGENCY_ALLOWED_REPO_OWNERS),
    assetSigningKey:
      env.AGENCY_ASSET_SIGNING_KEY ?? env.AGENCY_ADMIN_TOKEN ?? 'dev-only-signing-key',
    enableCapture: env.AGENCY_ENABLE_CAPTURE === '1',
  };
}
