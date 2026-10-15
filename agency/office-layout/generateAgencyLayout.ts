/**
 * Generates the PIXEL AGENCY office: six department rooms (3 on top, 3 at the
 * bottom) around a central lobby, built only from the furniture shipped with
 * Pixel Agents. Each room is an office Area labeled with its department, so
 * the existing Area-biased seat picker sends every agent to its department.
 *
 *   npm run office:layout   →  agency/office-layout/agency-layout.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEPARTMENTS, type Department } from '../shared/src/departments.ts';

const WALL = 0;
const VOID = 255;
const LOBBY_FLOOR = 9;
const WALL_COLOR = { h: 214, s: 30, b: -100, c: -55 };
const LOBBY_COLOR = { h: 209, s: 0, b: -16, c: -8 };

/** Interior size of a department room, in tiles. */
const ROOM_W = 12;
const ROOM_H = 9;
const LOBBY_H = 6;
/** Void rows above the top wall so tall wall-mounted items stay on the map. */
const TOP_PAD = 1;

/** Footprint heights of wall-mounted items (their BOTTOM row sits on the wall). */
const WALL_ITEM_H: Record<string, number> = {
  WHITEBOARD: 2,
  DOUBLE_BOOKSHELF: 2,
  LARGE_PAINTING: 2,
  CLOCK: 2,
  HANGING_PLANT: 2,
  SMALL_PAINTING: 2,
  SMALL_PAINTING_2: 2,
  BOOKSHELF: 1,
};

export const AGENCY_LAYOUT_REVISION = 1;

interface Furniture {
  uid: string;
  type: string;
  col: number;
  row: number;
}

interface Color {
  h: number;
  s: number;
  b: number;
  c: number;
}

export interface AgencyLayout {
  version: 1;
  cols: number;
  rows: number;
  layoutRevision: number;
  tiles: number[];
  tileColors: Array<Color | null>;
  furniture: Furniture[];
  areas: Array<{ label: string; color: string }>;
  areaTiles: Array<string | null>;
}

export function generateAgencyLayout(): AgencyLayout {
  const cols = 3 * ROOM_W + 4; // 4 vertical walls
  const rows = TOP_PAD + 1 + ROOM_H + 1 + LOBBY_H + 1 + ROOM_H + 1;
  const tiles = new Array<number>(cols * rows).fill(VOID);
  const tileColors = new Array<Color | null>(cols * rows).fill(null);
  const areaTiles = new Array<string | null>(cols * rows).fill(null);
  const furniture: Furniture[] = [];
  let seq = 0;
  const idx = (c: number, r: number) => r * cols + c;
  const place = (type: string, col: number, row: number) => {
    // Wall items are addressed by the wall row; their footprint grows upward.
    const h = WALL_ITEM_H[type];
    const top = h ? row - (h - 1) : row;
    furniture.push({ uid: `agency-${(++seq).toString().padStart(3, '0')}`, type, col, row: top });
  };
  const setTile = (c: number, r: number, t: number, color: Color | null) => {
    tiles[idx(c, r)] = t;
    tileColors[idx(c, r)] = color;
  };

  // Shell: everything inside the bounding box is wall, then carve floors.
  for (let r = TOP_PAD; r < rows; r++) {
    for (let c = 0; c < cols; c++) setTile(c, r, WALL, WALL_COLOR);
  }

  const topRow0 = TOP_PAD + 1;
  const lobbyRow0 = topRow0 + ROOM_H + 1;
  const bottomRow0 = lobbyRow0 + LOBBY_H + 1;

  // Lobby (corridor between the two rows of rooms).
  for (let r = lobbyRow0; r < lobbyRow0 + LOBBY_H; r++) {
    for (let c = 1; c < cols - 1; c++) setTile(c, r, LOBBY_FLOOR, LOBBY_COLOR);
  }

  const rooms: Array<{ dept: Department; c0: number; r0: number; top: boolean }> = [];
  DEPARTMENTS.forEach((dept, i) => {
    const top = i < 3;
    const slot = i % 3;
    rooms.push({ dept, c0: 1 + slot * (ROOM_W + 1), r0: top ? topRow0 : bottomRow0, top });
  });

  for (const { dept, c0, r0, top } of rooms) {
    for (let r = r0; r < r0 + ROOM_H; r++) {
      for (let c = c0; c < c0 + ROOM_W; c++) {
        setTile(c, r, dept.floorPattern, dept.floor);
        areaTiles[idx(c, r)] = dept.areaLabel;
      }
    }
    // Door: two tiles in the wall facing the lobby.
    const doorRow = top ? r0 + ROOM_H : r0 - 1;
    const doorCol = c0 + Math.floor(ROOM_W / 2) - 1;
    for (const c of [doorCol, doorCol + 1]) setTile(c, doorRow, LOBBY_FLOOR, LOBBY_COLOR);

    // Four workstations: desk (3x2) + PC on the desk + chair facing it.
    // Top rooms: desks against the back wall rows; bottom rooms mirror it.
    const deskRows = top ? [r0 + 1, r0 + 5] : [r0 + 1, r0 + 5];
    for (const dr of deskRows) {
      for (const dc of [c0 + 1, c0 + 7]) {
        place('DESK_FRONT', dc, dr);
        place('PC_FRONT_OFF', dc + 1, dr);
        place('CUSHIONED_CHAIR_BACK', dc + 1, dr + 2);
      }
    }
    decorate(dept, c0, r0, place);
  }

  // Lobby: lounge in the middle, plants, coffee corner.
  const midC = Math.floor(cols / 2);
  place('SOFA_FRONT', midC - 1, lobbyRow0 + 1);
  place('COFFEE_TABLE', midC - 1, lobbyRow0 + 2);
  place('SOFA_BACK', midC - 1, lobbyRow0 + 4);
  place('SOFA_SIDE', midC - 2, lobbyRow0 + 2);
  place('SOFA_SIDE:left', midC + 1, lobbyRow0 + 2);
  place('COFFEE', midC - 1, lobbyRow0 + 3);
  place('LARGE_PLANT', 2, lobbyRow0 + 1);
  place('LARGE_PLANT', cols - 4, lobbyRow0 + 1);
  place('SMALL_TABLE_FRONT', 6, lobbyRow0 + 2);
  place('COFFEE', 6, lobbyRow0 + 3);
  place('POT', 9, lobbyRow0 + 4);
  place('PLANT_2', cols - 8, lobbyRow0 + 3);
  place('BIN', cols - 10, lobbyRow0 + 4);

  return {
    version: 1,
    cols,
    rows,
    layoutRevision: AGENCY_LAYOUT_REVISION,
    tiles,
    tileColors,
    furniture,
    areas: DEPARTMENTS.map((d) => ({ label: d.areaLabel, color: d.color })),
    areaTiles,
  };
}

/** Department-specific decor so every room reads differently. */
function decorate(
  dept: Department,
  c0: number,
  r0: number,
  place: (type: string, col: number, row: number) => void,
): void {
  const wallRow = r0 - 1; // wall-mounted items sit on the room's top wall
  const right = c0 + ROOM_W - 1;
  const bottom = r0 + ROOM_H - 1;
  switch (dept.id) {
    case 'desenvolvimento':
      place('WHITEBOARD', c0 + 1, wallRow);
      place('DOUBLE_BOOKSHELF', c0 + 8, wallRow);
      place('CLOCK', c0 + 5, wallRow);
      place('PLANT', right, r0 + 1);
      place('BIN', c0, bottom);
      break;
    case 'automacoes':
      place('CLOCK', c0 + 1, wallRow);
      place('WHITEBOARD', c0 + 7, wallRow);
      place('BOOKSHELF', c0 + 3, wallRow);
      place('CACTUS', right, r0 + 1);
      place('COFFEE', c0 + 3, r0 + 5);
      break;
    case 'marketing':
      place('LARGE_PAINTING', c0 + 1, wallRow);
      place('SMALL_PAINTING', c0 + 5, wallRow);
      place('SMALL_PAINTING_2', c0 + 9, wallRow);
      place('HANGING_PLANT', c0 + 7, wallRow);
      place('PLANT_2', right, r0 + 1);
      place('POT', c0, bottom);
      break;
    case 'design':
      place('LARGE_PAINTING', c0 + 8, wallRow);
      place('SMALL_PAINTING_2', c0 + 2, wallRow);
      place('HANGING_PLANT', c0 + 4, wallRow);
      place('CACTUS', right, r0 + 1);
      place('POT', right, bottom);
      break;
    case 'qualidade':
      place('WHITEBOARD', c0 + 3, wallRow);
      place('CLOCK', c0 + 9, wallRow);
      place('BOOKSHELF', c0 + 1, wallRow);
      place('PLANT', right, r0 + 1);
      place('BIN', right, bottom);
      break;
    case 'infraestrutura':
      place('DOUBLE_BOOKSHELF', c0 + 1, wallRow);
      place('DOUBLE_BOOKSHELF', c0 + 9, wallRow);
      place('CLOCK', c0 + 4, wallRow);
      place('PLANT_2', right, r0 + 1);
      place('BIN', c0, bottom);
      break;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agency-layout.json');
  fs.writeFileSync(out, JSON.stringify(generateAgencyLayout()) + '\n');
  console.log(`[office-layout] wrote ${path.relative(process.cwd(), out)}`);
}
