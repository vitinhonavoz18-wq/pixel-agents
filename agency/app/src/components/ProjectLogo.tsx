import { Image } from 'expo-image';
import { View } from 'react-native';

import { useThemeForProject } from '../theme/ProjectThemeProvider';
import { colors } from '../theme/theme';
import { Txt } from './ui';

/**
 * Shows the project's OFFICIAL logo as extracted from its repository by the
 * ProjectBrandingEngine. When none was extracted yet, a neutral monogram is
 * shown (never an invented logo).
 */
export function ProjectLogo({ projectId, size = 28 }: { projectId?: string; size?: number }) {
  const theme = useThemeForProject(projectId);
  if (theme.logoUrl) {
    return (
      <Image
        source={{ uri: theme.logoUrl }}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel={`Logo oficial de ${theme.projectName}`}
      />
    );
  }
  const initials = theme.projectName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View
      accessibilityLabel={`${theme.projectName} (logo ainda não extraída)`}
      style={{
        width: size,
        height: size,
        backgroundColor: colors.panelHi,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={Math.max(9, size * 0.38)} muted>
        {initials || '?'}
      </Txt>
    </View>
  );
}
