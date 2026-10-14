import { Button } from '../components/ui/Button.js';

interface AgencyEmbedToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

/**
 * The only in-canvas control in the Pixel Agency embed: toggling the layout
 * editor ("Organizar escritório"). Agents, missions and settings live in the
 * host app, so the desktop BottomToolbar is not rendered.
 */
export function AgencyEmbedToolbar({ isEditMode, onToggleEditMode }: AgencyEmbedToolbarProps) {
  return (
    <div className="absolute bottom-10 left-10 z-20 pixel-panel p-4 flex gap-4">
      <Button
        variant={isEditMode ? 'active' : 'default'}
        size="md"
        onClick={onToggleEditMode}
        title="Organizar escritório"
        aria-label="Organizar escritório"
      >
        {isEditMode ? 'Concluir' : 'Organizar'}
      </Button>
    </div>
  );
}
