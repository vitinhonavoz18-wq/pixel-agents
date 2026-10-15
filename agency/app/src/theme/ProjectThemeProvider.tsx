import type { ProjectBranding } from '@pixel-agency/shared';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { useAgency } from '../state/store';
import { colors } from './theme';

export interface ProjectTheme {
  projectId: string | null;
  projectName: string;
  /** Project accent — applied ONLY to project-specific elements. */
  accent: string;
  /** Signed URL of the selected official logo, when extracted. */
  logoUrl?: string;
  branding?: ProjectBranding;
}

const Ctx = createContext<ProjectTheme>({
  projectId: null,
  projectName: '',
  accent: colors.orange,
});

export function projectThemeFor(
  projectId: string | null,
  name: string,
  branding: ProjectBranding | undefined,
  assetUrl: (p?: string) => string | undefined,
): ProjectTheme {
  const logo = branding?.logoCandidates.find((c) => c.path === branding.selectedLogoPath);
  return {
    projectId,
    projectName: name,
    accent: branding?.theme.primary ?? colors.orange,
    logoUrl: assetUrl(logo?.url),
    branding,
  };
}

/**
 * ProjectThemeProvider — exposes the ACTIVE project's identity (logo, accent)
 * extracted from its repository. The PIXEL AGENCY chrome keeps its own
 * palette; only project elements (selector, kanban header, cards, reports)
 * read from this context.
 */
export function ProjectThemeProvider({ children }: { children: ReactNode }) {
  const projectId = useAgency((s) => s.selectedProjectId);
  const project = useAgency((s) => (projectId ? s.projects[projectId] : undefined));
  const branding = useAgency((s) => (projectId ? s.branding[projectId] : undefined));
  const api = useAgency((s) => s.api);
  const value = useMemo(
    () => projectThemeFor(projectId, project?.name ?? '', branding, (p) => api?.assetUrl(p)),
    [projectId, project?.name, branding, api],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useProjectTheme = () => useContext(Ctx);

/** Theme for an arbitrary project (cards that are not the active project). */
export function useThemeForProject(projectId: string | undefined): ProjectTheme {
  const project = useAgency((s) => (projectId ? s.projects[projectId] : undefined));
  const branding = useAgency((s) => (projectId ? s.branding[projectId] : undefined));
  const api = useAgency((s) => s.api);
  return useMemo(
    () =>
      projectThemeFor(projectId ?? null, project?.name ?? '', branding, (p) => api?.assetUrl(p)),
    [projectId, project?.name, branding, api],
  );
}
