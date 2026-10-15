import {
  addUsage,
  EMPTY_USAGE,
  type Mission,
  type OrgCost,
  type SubscriptionLimits,
  type UsageAlert,
  type UsageAlertRule,
  type UsageGroup,
  type UsageRecord,
  type UsageSummary,
  type UsageTotals,
} from '@pixel-agency/shared';

import type { EventBus } from './events.js';
import type { ExecutorResult } from './executor/types.js';
import type { AgencyStore } from './store.js';
import { newId, nowIso } from './util/ids.js';

const LIMITS_KEY = 'subscriptionLimits';
const ORG_COST_TTL_MS = 10 * 60_000;

const NO_LIMITS: SubscriptionLimits = {
  available: false,
  reason:
    'Dados de limite indisponíveis nesta integração. Os limites da assinatura Claude (sessão/semanal) só são ' +
    'publicados pelo Claude Code na statusline local — conecte o Desktop Bridge para exibi-los.',
};

/**
 * ClaudeUsageProvider — every number it reports says where it came from:
 *  - agent tokens/cost: `result.modelUsage` / `total_cost_usd` of the Claude
 *    Agent SDK (cost is the SDK's local estimate, not a bill);
 *  - subscription limits: only via the Desktop Bridge (Claude Code statusline
 *    `rate_limits`), otherwise explicitly unavailable;
 *  - organization cost: Admin API cost report, only with ANTHROPIC_ADMIN_KEY;
 *  - prepaid credit balance: no official API exists → always unavailable.
 */
export class UsageService {
  private orgCostCache: { at: number; value: OrgCost } | null = null;

  constructor(
    private readonly store: AgencyStore,
    private readonly bus: EventBus,
    private readonly adminKey?: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  recordMission(mission: Mission, result: ExecutorResult): UsageRecord[] {
    const entries = Object.entries(result.perModel);
    if (entries.length === 0 && result.usage.inputTokens + result.usage.outputTokens > 0) {
      entries.push([result.model ?? 'desconhecido', result.usage]);
    }
    const perModelCost = entries.reduce((s, [, u]) => s + u.costUsd, 0);
    const records: UsageRecord[] = [];
    for (const [model, u] of entries) {
      // Distribute the SDK's authoritative total cost proportionally if the
      // per-model sum differs (it normally matches).
      const cost =
        perModelCost > 0
          ? (u.costUsd / perModelCost) * result.usage.costUsd
          : result.usage.costUsd / entries.length;
      const rec: UsageRecord = {
        id: newId('u'),
        missionId: mission.id,
        agentId: mission.agentId,
        projectId: mission.projectId,
        model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cacheReadTokens: u.cacheReadTokens,
        cacheCreationTokens: u.cacheCreationTokens,
        costUsd: Math.round(cost * 1e6) / 1e6,
        costSource: 'agent_sdk_estimate',
        ts: nowIso(),
      };
      this.store.usage.put(rec);
      records.push(rec);
    }
    if (records.length > 0) {
      this.bus.publish({ type: 'usageChanged' });
      this.evaluateAlerts();
    }
    return records;
  }

  // ── Subscription limits (Desktop Bridge) ────────────────────────────────

  setLimits(limits: SubscriptionLimits): void {
    this.store.setKv(LIMITS_KEY, limits);
    this.bus.publish({ type: 'usageChanged' });
    this.evaluateAlerts();
  }

  limits(): SubscriptionLimits {
    return this.store.getKv<SubscriptionLimits>(LIMITS_KEY, NO_LIMITS);
  }

  // ── Organization cost (Admin API, optional) ─────────────────────────────

  async orgCost(now = new Date()): Promise<OrgCost> {
    if (!this.adminKey) {
      return {
        available: false,
        reason: 'Custo da organização requer ANTHROPIC_ADMIN_KEY (Admin API, chave sk-ant-admin…).',
      };
    }
    if (this.orgCostCache && Date.now() - this.orgCostCache.at < ORG_COST_TTL_MS) {
      return this.orgCostCache.value;
    }
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const url = new URL('https://api.anthropic.com/v1/organizations/cost_report');
    url.searchParams.set('starting_at', start.toISOString());
    url.searchParams.set('ending_at', now.toISOString());
    let value: OrgCost;
    try {
      let total = 0;
      let page: string | undefined;
      for (let i = 0; i < 20; i++) {
        if (page) url.searchParams.set('page', page);
        const res = await this.fetchFn(url, {
          headers: { 'x-api-key': this.adminKey, 'anthropic-version': '2023-06-01' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as {
          data?: Array<{ results?: Array<{ amount?: string | number }> }>;
          has_more?: boolean;
          next_page?: string;
        };
        for (const bucket of body.data ?? []) {
          for (const r of bucket.results ?? []) {
            const n = typeof r.amount === 'number' ? r.amount : Number(r.amount);
            if (Number.isFinite(n)) total += n;
          }
        }
        if (!body.has_more || !body.next_page) break;
        page = body.next_page;
      }
      value = {
        available: true,
        source: 'admin_cost_report',
        periodStart: start.toISOString(),
        periodEnd: now.toISOString(),
        totalUsd: Math.round(total * 100) / 100,
        fetchedAt: nowIso(),
      };
    } catch (err) {
      value = {
        available: false,
        reason: `Falha ao consultar a Admin API: ${(err as Error).message}`,
      };
    }
    this.orgCostCache = { at: Date.now(), value };
    return value;
  }

  // ── Aggregation ─────────────────────────────────────────────────────────

  async summary(): Promise<UsageSummary> {
    const records = this.store.usage.all().sort((a, b) => b.ts.localeCompare(a.ts));
    const agents = new Map(this.store.agents.all().map((a) => [a.id, a.name]));
    const projects = new Map(this.store.projects.all().map((p) => [p.id, p.name]));
    const missions = new Map(this.store.missions.all().map((m) => [m.id, m.title]));
    const group = (
      keyOf: (r: UsageRecord) => string,
      labelOf: (k: string) => string,
    ): UsageGroup[] => {
      const m = new Map<string, { totals: UsageTotals; missions: Set<string> }>();
      for (const r of records) {
        const k = keyOf(r);
        const g = m.get(k) ?? { totals: { ...EMPTY_USAGE }, missions: new Set<string>() };
        g.totals = addUsage(g.totals, r);
        g.missions.add(r.missionId);
        m.set(k, g);
      }
      return [...m.entries()]
        .map(([key, g]) => ({
          key,
          label: labelOf(key),
          totals: g.totals,
          missions: g.missions.size,
        }))
        .sort(
          (a, b) =>
            b.totals.costUsd - a.totals.costUsd || b.totals.outputTokens - a.totals.outputTokens,
        )
        .slice(0, 50);
    };
    let totals = { ...EMPTY_USAGE };
    for (const r of records) totals = addUsage(totals, r);
    return {
      generatedAt: nowIso(),
      limits: this.limits(),
      credits: {
        available: false,
        reason: 'Não há API oficial para consultar saldo de créditos pré-pagos da Anthropic.',
      },
      orgCost: await this.orgCost(),
      totals,
      byAgent: group(
        (r) => r.agentId,
        (k) => agents.get(k) ?? k,
      ),
      byProject: group(
        (r) => r.projectId,
        (k) => projects.get(k) ?? k,
      ),
      byModel: group(
        (r) => r.model,
        (k) => k,
      ),
      byMission: group(
        (r) => r.missionId,
        (k) => missions.get(k) ?? k,
      ),
      recent: records.slice(0, 50),
    };
  }

  // ── UsageAlertsService ──────────────────────────────────────────────────

  evaluateAlerts(now = new Date()): UsageAlert[] {
    const fired: UsageAlert[] = [];
    const limits = this.limits();
    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    const records = this.store.usage.all();
    const costSince = (prefix: string) =>
      records.filter((r) => r.ts.startsWith(prefix)).reduce((s, r) => s + r.costUsd, 0);

    for (const rule of this.store.alertRules.all()) {
      if (!rule.enabled) continue;
      let value: number | undefined;
      let period = '';
      switch (rule.metric) {
        case 'session_percent':
          if (limits.available && limits.session) {
            value = limits.session.usedPercent;
            period = limits.session.resetsAt ?? dayKey;
          }
          break;
        case 'weekly_percent':
          if (limits.available && limits.weekly) {
            value = limits.weekly.usedPercent;
            period = limits.weekly.resetsAt ?? monthKey;
          }
          break;
        case 'cost_usd_day':
          value = costSince(dayKey);
          period = dayKey;
          break;
        case 'cost_usd_month':
          value = costSince(monthKey);
          period = monthKey;
          break;
      }
      if (value === undefined || value < rule.threshold) continue;
      const firedKey = `alertFired:${rule.id}`;
      if (this.store.getKv<string>(firedKey, '') === period) continue;
      this.store.setKv(firedKey, period);
      const alert: UsageAlert = {
        id: newId('al'),
        ruleId: rule.id,
        metric: rule.metric,
        value: Math.round(value * 100) / 100,
        threshold: rule.threshold,
        message: alertMessage(rule, value),
        ts: nowIso(),
      };
      this.bus.publish({ type: 'alert', alert });
      fired.push(alert);
    }
    return fired;
  }
}

function alertMessage(rule: UsageAlertRule, value: number): string {
  switch (rule.metric) {
    case 'session_percent':
      return `Limite de sessão Claude em ${value.toFixed(0)}% (alerta: ${rule.threshold}%).`;
    case 'weekly_percent':
      return `Limite semanal Claude em ${value.toFixed(0)}% (alerta: ${rule.threshold}%).`;
    case 'cost_usd_day':
      return `Custo estimado dos agentes hoje: US$ ${value.toFixed(2)} (alerta: US$ ${rule.threshold}).`;
    case 'cost_usd_month':
      return `Custo estimado dos agentes no mês: US$ ${value.toFixed(2)} (alerta: US$ ${rule.threshold}).`;
  }
}
