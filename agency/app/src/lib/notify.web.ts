/** Web: browser notifications when the user has allowed them; otherwise silent. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'granted') new Notification(title, { body });
  } catch {
    // best-effort
  }
}
