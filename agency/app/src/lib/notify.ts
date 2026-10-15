import * as Notifications from 'expo-notifications';

let permission: boolean | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Local notification (approvals, usage alerts). Never sends data anywhere. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (permission === null) {
      const current = await Notifications.getPermissionsAsync();
      permission = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!permission) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    // notifications are best-effort
  }
}
