import { Button } from '../components/ui/Button.js';
import { ZOOM_MAX, ZOOM_MIN } from '../constants.js';

interface AgencyEmbedToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * The only in-canvas controls in the Pixel Agency embed: zoom (pinch also
 * works) and the layout editor ("Organizar escritório"). Agents, missions and
 * settings live in the host app, so the desktop BottomToolbar is not
 * rendered. Docked mid-left, where the host's HUD panels never sit.
 */
export function AgencyEmbedToolbar({
  isEditMode,
  onToggleEditMode,
  zoom,
  onZoomChange,
}: AgencyEmbedToolbarProps) {
  return (
    <div className="absolute left-10 top-1/2 -translate-y-1/2 z-20 pixel-panel p-4 flex flex-col gap-4">
      <Button
        size="icon_lg"
        onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + 1))}
        disabled={zoom >= ZOOM_MAX}
        title="Aproximar"
        aria-label="Aproximar"
      >
        +
      </Button>
      <Button
        size="icon_lg"
        onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - 1))}
        disabled={zoom <= ZOOM_MIN}
        title="Afastar"
        aria-label="Afastar"
      >
        −
      </Button>
      <Button
        variant={isEditMode ? 'active' : 'default'}
        size="icon_lg"
        onClick={onToggleEditMode}
        title={isEditMode ? 'Concluir organização' : 'Organizar escritório'}
        aria-label={isEditMode ? 'Concluir organização' : 'Organizar escritório'}
      >
        {isEditMode ? '✓' : '✎'}
      </Button>
    </div>
  );
}
