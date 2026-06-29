// Desktop notifications (Web Notifications API) for the diff-review session.
// localhost is a secure context, so this works without HTTPS. Every call
// no-ops gracefully when notifications are unsupported or not granted.

const ICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2044%2032%22%3E%3Cline%20x1%3D%220%22%20y1%3D%2216%22%20x2%3D%2216%22%20y2%3D%2216%22%20stroke%3D%22%23e6edf3%22%20stroke-width%3D%222.4%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2216%22%20x2%3D%2244%22%20y2%3D%228%22%20stroke%3D%22%23ff5f5f%22%20stroke-width%3D%222.2%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2216%22%20x2%3D%2244%22%20y2%3D%2212%22%20stroke%3D%22%23ffaf5f%22%20stroke-width%3D%222.2%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2216%22%20x2%3D%2244%22%20y2%3D%2216%22%20stroke%3D%22%23ffd75f%22%20stroke-width%3D%222.2%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2216%22%20x2%3D%2244%22%20y2%3D%2220%22%20stroke%3D%22%2387ff87%22%20stroke-width%3D%222.2%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2216%22%20x2%3D%2244%22%20y2%3D%2223%22%20stroke%3D%22%235fafff%22%20stroke-width%3D%222.2%22%2F%3E%3Cpath%20d%3D%22M20%204%20L9%2027%20L31%2027%20Z%22%20fill%3D%22%23161b22%22%20stroke%3D%22%23af87ff%22%20stroke-width%3D%222%22%2F%3E%3C%2Fsvg%3E";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : "denied";
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

interface FireOptions {
  body?: string;
  tag?: string;
  /** Fire even when the tab is focused/visible. Default false (only when hidden). */
  force?: boolean;
}

export function fireNotification(title: string, opts: FireOptions = {}): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  // Skip ambient events while the user is already looking at the tab, but let
  // important ones (force) through regardless of focus.
  if (!opts.force && typeof document !== "undefined" && !document.hidden) return;
  try {
    const n = new Notification(title, {
      body: opts.body,
      tag: opts.tag,
      icon: ICON,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* ignore — notifications are best-effort */
  }
}

/** First non-empty line of a markdown string, truncated for a notification body. */
export function summarize(markdown: string, max = 120): string {
  const line = markdown.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}
