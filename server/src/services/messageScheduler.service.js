import { claimDueMessages } from "../features/messages/message.scheduler.js";
import { emitToConversation } from "../features/messages/message.controller.js";
import { notifyMessageSent } from "../features/chat/chat.controller.js";

/**
 * Lightweight in-process scheduler for due scheduled messages.
 *
 * Design notes:
 *  - No external job queue exists in this project, so this polls MongoDB. The
 *    due-time decision is made entirely by the server clock.
 *  - Claiming is atomic (findOneAndUpdate with status:"scheduled" still
 *    required), so overlapping ticks, or two server instances, cannot deliver
 *    the same message twice.
 *  - Pending messages live in MongoDB, so a restart resumes exactly where it
 *    left off. Messages that were mid-flight when the process died are
 *    reclaimed because only an atomic claim flips them to "sent".
 */

const DEFAULT_INTERVAL_MS = 15 * 1000;

let timer = null;
let running = false;
/** Exposed for tests: lets a caller force an immediate sweep. */
export const tick = async ({ now = new Date() } = {}) => {
  if (running) return { claimed: 0, sent: 0, skipped: 0 };
  running = true;

  let sent = 0;
  let skipped = 0;
  let due = [];

  try {
    due = await claimDueMessages({ now });

    for (const message of due) {
      try {
        // Same Socket.IO event and notification path as an instant message.
        await emitToConversation(message);
        await notifyMessageSent(message, message.sender);
        sent += 1;
      } catch (error) {
        // Keep the message "sent" rather than re-emitting it on the next tick;
        // it is already persisted and will appear in conversation history.
        skipped += 1;
        console.error(
          `[scheduler] failed to emit scheduled message ${message._id}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error("[scheduler] sweep failed:", error.message);
  } finally {
    running = false;
  }

  return { claimed: due.length, sent, skipped };
};

export const startScheduler = ({
  intervalMs = Number.parseInt(process.env.SCHEDULER_INTERVAL_MS ?? "", 10) || DEFAULT_INTERVAL_MS,
} = {}) => {
  if (timer) return timer;

  console.log(`[scheduler] started (every ${Math.round(intervalMs / 1000)}s)`);

  const loop = async () => {
    const result = await tick();
    if (result.sent > 0) {
      console.log(`[scheduler] delivered ${result.sent} scheduled message(s)`);
    }
  };

  // Do not fire immediately on boot: indexes/connections may still be settling.
  timer = setInterval(loop, intervalMs);
  if (typeof timer.unref === "function") timer.unref();

  return timer;
};

export const stopScheduler = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log("[scheduler] stopped");
};