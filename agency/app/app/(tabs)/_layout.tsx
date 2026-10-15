import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { selectPendingApprovals, useAgency } from '../../src/state/store';
import { colors, fonts } from '../../src/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({
    focused,
    color,
  }: {
    focused: boolean;
    color: import('react-native').ColorValue;
  }) => <Ionicons name={focused ? iconActive : icon} size={22} color={color as string} />,
});

export default function TabsLayout() {
  const activeMissions = useAgency(
    (s) =>
      Object.values(s.missions).filter(
        (m) =>
          m.kind === 'task' &&
          ['queued', 'running', 'testing', 'awaiting_approval'].includes(m.status),
      ).length,
  );
  const pending = useAgency((s) => selectPendingApprovals(s).length);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgDeep,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.pixel, fontSize: 12 },
        tabBarBadgeStyle: { backgroundColor: colors.red, fontFamily: fonts.pixel },
      }}
    >
      <Tabs.Screen name="index" options={tab('Agência', 'home-outline', 'home')} />
      <Tabs.Screen
        name="projects"
        options={tab('Projetos', 'folder-open-outline', 'folder-open')}
      />
      <Tabs.Screen
        name="missions"
        options={{
          ...tab('Tarefas', 'checkbox-outline', 'checkbox'),
          tabBarBadge: activeMissions + pending || undefined,
        }}
      />
      <Tabs.Screen name="chat" options={tab('Chat', 'chatbubble-outline', 'chatbubble')} />
      <Tabs.Screen name="settings" options={tab('Config', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
