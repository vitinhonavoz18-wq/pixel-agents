import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Txt } from '../src/components/ui';
import { colors } from '../src/theme/theme';

export default function NotFound() {
  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: 'Não encontrado' }} />
      <Txt size={16}>Esta sala da agência não existe.</Txt>
      <Link href="/">
        <Txt color={colors.orange}>Voltar ao escritório</Txt>
      </Link>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bg,
  },
});
