/**
 * The six agency departments. Each one is an Area in the office layout
 * (`areaLabel`), so an agent mapped to a department sits in that room — the
 * office's existing Area-biased seat picker does the work.
 */
export interface DepartmentFloor {
  h: number;
  s: number;
  b: number;
  c: number;
}

export interface Department {
  id: DepartmentId;
  name: string;
  /** Label of the office Area (and the `areaMappings` value). */
  areaLabel: string;
  /** Accent color (hex RGB) for the Area overlay and UI chips. */
  color: string;
  /** Colorize values for the room's floor tiles. */
  floor: DepartmentFloor;
  /** Floor pattern (TileType 1..9) for the room. */
  floorPattern: number;
  description: string;
  icon: string;
}

export const DEPARTMENT_IDS = [
  'desenvolvimento',
  'automacoes',
  'marketing',
  'design',
  'qualidade',
  'infraestrutura',
] as const;

export type DepartmentId = (typeof DEPARTMENT_IDS)[number];

export const DEPARTMENTS: readonly Department[] = [
  {
    id: 'desenvolvimento',
    name: 'Desenvolvimento',
    areaLabel: 'Desenvolvimento',
    color: '#4a90e2',
    floor: { h: 214, s: 38, b: -28, c: -62 },
    floorPattern: 1,
    description: 'Programação, refatoração, auditoria e manutenção de código.',
    icon: '</>',
  },
  {
    id: 'automacoes',
    name: 'Automações',
    areaLabel: 'Automações',
    color: '#f5a623',
    floor: { h: 32, s: 45, b: -36, c: -70 },
    floorPattern: 7,
    description: 'Integrações, APIs, workflows, webhooks e testes de automações.',
    icon: '⚙',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    areaLabel: 'Marketing',
    color: '#e056a0',
    floor: { h: 322, s: 32, b: -34, c: -66 },
    floorPattern: 9,
    description: 'Análise de projetos, relatórios e propostas de conteúdo.',
    icon: '📣',
  },
  {
    id: 'design',
    name: 'Design',
    areaLabel: 'Design',
    color: '#9b59b6',
    floor: { h: 276, s: 30, b: -32, c: -62 },
    floorPattern: 1,
    description: 'Interfaces, UX, componentes visuais e documentação de design.',
    icon: '✎',
  },
  {
    id: 'qualidade',
    name: 'Qualidade',
    areaLabel: 'Qualidade',
    color: '#2ecc71',
    floor: { h: 140, s: 30, b: -36, c: -66 },
    floorPattern: 7,
    description: 'Bugs, testes, segurança e integridade das funcionalidades.',
    icon: '✓',
  },
  {
    id: 'infraestrutura',
    name: 'Infraestrutura',
    areaLabel: 'Infraestrutura',
    color: '#1abc9c',
    floor: { h: 178, s: 28, b: -40, c: -60 },
    floorPattern: 9,
    description: 'Configuração, build, pipelines e deploys autorizados.',
    icon: '☁',
  },
];

export function getDepartment(id: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}
