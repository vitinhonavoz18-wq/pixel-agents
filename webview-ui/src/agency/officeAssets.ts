import type {
  CharacterSpriteSet,
  FurnitureAssetMessage,
  PetSpriteFrameSet,
  ServerMessage,
} from '../../../core/src/messages.js';

/**
 * Pre-decoded asset payload baked into the agency office bundle at build time
 * (see webview-ui/vite.agency.config.ts). Keeps the APK fully offline: the
 * WebView never fetches a PNG.
 */
export interface AgencyOfficeAssets {
  characters: CharacterSpriteSet[];
  floors: string[][][];
  walls: string[][][][];
  carpets: string[][][][];
  catalog: FurnitureAssetMessage[];
  furniture: Record<string, string[][]>;
  pets: PetSpriteFrameSet[];
  petNames: string[];
  layout: Record<string, unknown>;
  version: string;
}

/**
 * The boot sequence, in the load order the office requires (CLAUDE.md →
 * "Load order"). Settings favour the agency: names always visible and the
 * department Areas drawn.
 */
export function bootMessages(assets: AgencyOfficeAssets): ServerMessage[] {
  return [
    { type: 'characterSpritesLoaded', characters: assets.characters },
    { type: 'floorTilesLoaded', sprites: assets.floors },
    { type: 'wallTilesLoaded', sets: assets.walls },
    { type: 'carpetTilesLoaded', sets: assets.carpets },
    ...(assets.pets.length > 0
      ? [{ type: 'petSpritesLoaded' as const, pets: assets.pets, petNames: assets.petNames }]
      : []),
    { type: 'furnitureAssetsLoaded', catalog: assets.catalog, sprites: assets.furniture },
    { type: 'layoutLoaded', layout: assets.layout },
    {
      type: 'settingsLoaded',
      soundEnabled: false,
      lastSeenVersion: assets.version,
      extensionVersion: assets.version,
      watchAllSessions: false,
      alwaysShowLabels: true,
      ghostHeadlessAgents: false,
      hooksEnabled: false,
      hooksInfoShown: true,
      externalAssetDirectories: [],
      showAreas: true,
    },
  ];
}
