import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAgency } from '../state/store';
import { useProjectTheme } from '../theme/ProjectThemeProvider';
import { colors } from '../theme/theme';
import { ProjectLogo } from './ProjectLogo';
import { Chip, Panel, Txt } from './ui';

/** "Projeto atual" chip with the project's official logo; opens a picker. */
export function ProjectSelector() {
  const [open, setOpen] = useState(false);
  const theme = useProjectTheme();
  const projects = useAgency((s) => s.projects);
  const select = useAgency((s) => s.selectProject);
  const list = Object.values(projects)
    .filter((p) => !p.archived)
    .sort((a, b) => Number(b.authorized) - Number(a.authorized) || a.name.localeCompare(b.name));
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Selecionar projeto"
      >
        <Panel accent={theme.projectId ? theme.accent : undefined} style={s.chip} padded={false}>
          <ProjectLogo projectId={theme.projectId ?? undefined} size={30} />
          <View style={s.flex}>
            <Txt size={9} muted>
              Projeto atual
            </Txt>
            <Txt size={14} numberOfLines={1}>
              {theme.projectName || 'Selecionar'}
            </Txt>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Panel>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Panel style={s.sheet}>
            <Txt size={15} style={s.title}>
              Projetos
            </Txt>
            <FlatList
              data={list}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.item, item.id === theme.projectId && s.itemActive]}
                  onPress={() => {
                    select(item.id);
                    setOpen(false);
                  }}
                >
                  <ProjectLogo projectId={item.id} size={28} />
                  <View style={s.flex}>
                    <Txt size={13}>{item.name}</Txt>
                    <Txt size={10} muted numberOfLines={1}>
                      {item.repo ? `${item.repo.owner}/${item.repo.name}` : 'sem repositório'}
                    </Txt>
                  </View>
                  {item.authorized ? (
                    <Chip label="autorizado" color={colors.green} textColor={colors.bgDeep} />
                  ) : (
                    <Chip label="bloqueado" />
                  )}
                </Pressable>
              )}
            />
          </Panel>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 180,
    backgroundColor: 'rgba(14, 22, 44, 0.94)',
  },
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '80%' },
  title: { marginBottom: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemActive: { backgroundColor: colors.panelHi },
});
