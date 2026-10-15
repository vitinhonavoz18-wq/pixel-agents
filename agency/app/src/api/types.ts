import type {
  AgencyServerEvent,
  AgentInput,
  AgentPatch,
  AgentProfile,
  Approval,
  ChatMessage,
  DepartmentId,
  DesktopCommand,
  Mission,
  MissionCreate,
  MissionEvent,
  Project,
  ProjectBranding,
  ProjectInput,
  ProjectPreview,
  UsageAlertRule,
  UsageSummary,
} from '@pixel-agency/shared';

export type ConnectionState = 'connecting' | 'online' | 'offline' | 'unauthorized';

export interface GithubRepo {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
}

export interface MissionDiff {
  stat: string;
  patch: string;
  branch?: string;
  baseCommit?: string;
}

/**
 * Everything the app can ask of a backend. Two implementations: `HttpApi`
 * (the real cloud backend) and `DemoApi` (in-app, simulated, always labeled).
 */
export interface AgencyApi {
  readonly mode: 'cloud' | 'demo';
  readonly baseUrl: string;
  connect(
    onEvent: (e: AgencyServerEvent) => void,
    onState: (s: ConnectionState) => void,
  ): () => void;
  missionEvents(missionId: string, after?: number): Promise<MissionEvent[]>;
  missionDiff(missionId: string): Promise<MissionDiff>;
  createMission(input: MissionCreate): Promise<Mission>;
  missionAction(missionId: string, action: 'start' | 'cancel' | 'retry'): Promise<Mission>;
  resolveApproval(approvalId: string, decision: 'approve' | 'deny'): Promise<Approval>;
  chatHistory(agentId: string): Promise<ChatMessage[]>;
  sendChat(
    agentId: string,
    input: { text: string; projectId?: string; newSession?: boolean },
  ): Promise<{ mission: Mission }>;
  usageSummary(): Promise<UsageSummary>;
  alertRules(): Promise<UsageAlertRule[]>;
  saveAlertRules(rules: UsageAlertRule[]): Promise<UsageAlertRule[]>;
  createAgent(input: AgentInput): Promise<AgentProfile>;
  updateAgent(id: string, patch: AgentPatch): Promise<AgentProfile>;
  deleteAgent(id: string): Promise<void>;
  importAgent(text: string, department?: DepartmentId): Promise<AgentProfile>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<ProjectInput>): Promise<Project>;
  githubRepos(): Promise<GithubRepo[]>;
  refreshBranding(projectId: string): Promise<ProjectBranding>;
  selectLogo(projectId: string, path: string): Promise<ProjectBranding>;
  previews(projectId: string): Promise<ProjectPreview[]>;
  uploadPreview(
    projectId: string,
    input: { title: string; mime: string; dataBase64: string; filename?: string },
  ): Promise<ProjectPreview>;
  capturePreview(
    projectId: string,
    input: { url?: string; title: string },
  ): Promise<ProjectPreview>;
  desktopCommand(cmd: DesktopCommand): Promise<void>;
  /** Absolute URL for a signed asset path returned by the backend. */
  assetUrl(pathOrUrl: string | undefined): string | undefined;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
