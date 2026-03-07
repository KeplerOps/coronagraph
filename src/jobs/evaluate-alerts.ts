// ---------------------------------------------------------------------------
// CLI job: evaluate recent items for alerts and deliver notifications
//
// Usage:
//   bun src/jobs/evaluate-alerts.ts              # Default: last 4 hours
//   bun src/jobs/evaluate-alerts.ts --hours 2    # Custom lookback window
// ---------------------------------------------------------------------------

import type { AlertEvaluation } from "../analysis/alerts.ts";
import { evaluateAlerts } from "../analysis/alerts.ts";
import { getConfig } from "../config.ts";
import type { AlertEmailData } from "../delivery/email.ts";
import { sendAlertEmail } from "../delivery/email.ts";
import type { TelegramAlertData } from "../delivery/telegram.ts";
import { sendAlertNotification } from "../delivery/telegram.ts";

function parseArgs(): { hoursBack: number } {
  const args = process.argv.slice(2);
  let hoursBack = 4;

  const hoursIdx = args.indexOf("--hours");
  if (hoursIdx !== -1 && args[hoursIdx + 1]) {
    const parsed = Number(args[hoursIdx + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) {
      hoursBack = parsed;
    }
  }

  return { hoursBack };
}

function toEmailAlerts(alerts: AlertEvaluation[]): AlertEmailData[] {
  return alerts.map((a) => ({
    itemTitle: a.item.title,
    urgency: a.urgency,
    reason: a.reason,
    recommendedAction: a.recommendedAction,
    url: a.item.url,
  }));
}

function toTelegramAlerts(alerts: AlertEvaluation[]): TelegramAlertData[] {
  return alerts.map((a) => ({
    itemTitle: a.item.title,
    urgency: a.urgency,
    reason: a.reason,
    recommendedAction: a.recommendedAction,
    url: a.item.url,
  }));
}

async function main(): Promise<void> {
  const { hoursBack } = parseArgs();
  console.log(
    `[evaluate-alerts] Evaluating items from the last ${hoursBack} hours...`,
  );
  const start = Date.now();

  const alerts = await evaluateAlerts({ hoursBack });

  if (alerts.length === 0) {
    console.log("[evaluate-alerts] No alerts to deliver");
    process.exit(0);
  }

  // Filter to only critical and high urgency for notifications
  const notifiableAlerts = alerts.filter(
    (a) => a.urgency === "critical" || a.urgency === "high",
  );

  console.log(
    `[evaluate-alerts] ${alerts.length} total alerts, ${notifiableAlerts.length} critical/high`,
  );

  // Log all alerts to console regardless
  for (const alert of alerts) {
    console.log(`  [${alert.urgency.toUpperCase()}] ${alert.item.title}`);
    console.log(`    Reason: ${alert.reason}`);
    console.log(`    Action: ${alert.recommendedAction}`);
  }

  if (notifiableAlerts.length === 0) {
    console.log("[evaluate-alerts] No critical/high alerts to deliver");
    process.exit(0);
  }

  // Deliver notifications in parallel
  const config = getConfig();
  const deliveries: Promise<unknown>[] = [];

  // Email delivery
  if (config.RESEND_API_KEY && config.EMAIL_TO) {
    deliveries.push(
      sendAlertEmail(toEmailAlerts(notifiableAlerts)).then((result) => {
        if (result.success) {
          console.log(`[evaluate-alerts] Email sent: ${result.id}`);
        } else {
          console.error(`[evaluate-alerts] Email failed: ${result.error}`);
        }
      }),
    );
  }

  // Telegram delivery
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
    deliveries.push(
      sendAlertNotification(
        config.TELEGRAM_CHAT_ID,
        toTelegramAlerts(notifiableAlerts),
      ).then((results) => {
        const sent = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        console.log(
          `[evaluate-alerts] Telegram: ${sent} sent, ${failed} failed`,
        );
      }),
    );
  }

  if (deliveries.length > 0) {
    await Promise.allSettled(deliveries);
  } else {
    console.log(
      "[evaluate-alerts] No delivery channels configured (set RESEND_API_KEY/EMAIL_TO or TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)",
    );
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[evaluate-alerts] Complete in ${elapsed}s`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[evaluate-alerts] Fatal error:", err);
  process.exit(1);
});
