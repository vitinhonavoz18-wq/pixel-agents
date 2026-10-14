import type {
  AgentProfile,
  AgentRuntimeState,
  Approval,
  Capabilities,
  ChatMessage,
  Mission,
  MissionEvent,
  Project,
  ProjectBranding,
  ProjectPreview,
  UsageAlert,
} from './schemas.js';

/** Events the backend pushes over `GET /api/ws`. */
export type AgencyServerEvent =
  | {
      type: 'snapshot';
      agents: AgentProfile[];
      runtimes: AgentRuntimeState[];
      projects: Project[];
      missions: Mission[];
      approvals: Approval[];
      branding: ProjectBranding[];
      capabilities: Capabilities;
    }
  | { type: 'agent'; agent: AgentProfile }
  | { type: 'agentDeleted'; agentId: string }
  | { type: 'runtime'; state: AgentRuntimeState }
  | { type: 'project'; project: Project }
  | { type: 'projectDeleted'; projectId: string }
  | { type: 'mission'; mission: Mission }
  | { type: 'missionEvent'; event: MissionEvent }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'approval'; approval: Approval }
  | { type: 'branding'; branding: ProjectBranding }
  | { type: 'preview'; preview: ProjectPreview }
  | { type: 'usageChanged' }
  | { type: 'alert'; alert: UsageAlert }
  | { type: 'capabilities'; capabilities: Capabilities }
  | { type: 'pong'; ts: string };

/** Messages the app may send over the socket (actions go through REST). */
export type AgencyClientEvent = { type: 'ping' };

export const AGENCY_API_VERSION = '1';

/** Close codes used by the backend socket. */
export const WS_CLOSE_UNAUTHORIZED = 4401;
