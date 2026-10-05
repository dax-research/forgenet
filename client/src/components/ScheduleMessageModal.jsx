import { useEffect, useMemo, useState } from "react";
import { Clock, Calendar } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

/**
 * Schedule-a-message dialog.
 *
 * Timezone handling: the user picks a wall-clock time in THEIR timezone, and we
 * convert it to UTC before handing it to the backend. The reverse happens on
 * display. Server time remains authoritative for whether a time is valid — the
 * checks here are only for immediate feedback.
 */

const MIN_LEAD_MS = 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Local calendar parts for a Date, as the user would read them. */
const localParts = (date) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
  hour: date.getHours(),
  minute: date.getMinutes(),
});

/** Builds a local-time Date from the user's selection. */
const fromLocalParts = ({ year, month, day, hour, minute, meridiem }) => {
  let h = hour % 12;
  if (meridiem === "PM") h += 12;
  // Second 0 so the value is stable; we add the lead time in validation.
  return new Date(year, month - 1, day, h, minute, 0, 0);
};

export const formatScheduledForUser = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function ScheduleMessageModal({
  isOpen,
  onClose,
  onSchedule,
  initialDate = null,
}) {
  // Default to ~1 hour from now, in the user's timezone.
  const defaults = useMemo(() => {
    const base = initialDate ? new Date(initialDate) : new Date(Date.now() + 60 * 60 * 1000);
    const p = localParts(base);
    return {
      year: String(p.year),
      month: String(p.month),
      day: String(p.day),
      hour: String(p.hour === 0 ? 12 : p.hour % 12),
      minute: String(p.minute).padStart(2, "0"),
      meridiem: p.hour < 12 ? "AM" : "PM",
    };
  }, [initialDate]);

  const [form, setForm] = useState(defaults);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(defaults);
      setError("");
    }
  }, [isOpen, defaults]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSchedule = async () => {
    setError("");

    const year = Number(form.year);
    const month = Number(form.month);
    const day = Number(form.day);
    const hour = Number(form.hour);
    const minute = Number(form.minute);

    if (!year || !month || !day || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      setError("Please choose a valid date.");
      return;
    }
    if (Number.isNaN(hour) || hour < 1 || hour > 12) {
      setError("Hour must be between 1 and 12.");
      return;
    }
    if (Number.isNaN(minute) || minute < 0 || minute > 59) {
      setError("Minutes must be between 00 and 59.");
      return;
    }

    const chosen = fromLocalParts({ ...form, year, month, day, hour, minute });

    // Reject a non-existent date (e.g. 31 February) by round-tripping.
    if (
      chosen.getFullYear() !== year ||
      chosen.getMonth() + 1 !== month ||
      chosen.getDate() !== day
    ) {
      setError("That date does not exist.");
      return;
    }

    const now = Date.now();
    if (chosen.getTime() <= now) {
      setError("Choose a time in the future.");
      return;
    }
    if (chosen.getTime() - now < MIN_LEAD_MS) {
      setError("Choose a time at least a minute from now.");
      return;
    }
    if (chosen.getTime() - now > MONTH_MS) {
      setError("You can only schedule up to one month ahead.");
      return;
    }

    try {
      setSaving(true);
      // toISOString converts the user's local time to UTC for the backend.
      await onSchedule(chosen.toISOString());
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not schedule the message.");
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    padding: "6px 8px",
    fontSize: "13px",
    borderRadius: "var(--radius-btn)",
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    color: "var(--text-primary)",
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Schedule Message" maxWidth="420px">
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-btn)",
              backgroundColor: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              color: "var(--danger)",
              fontSize: "12.5px",
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label className="form-label">
            <Calendar size={12} style={{ marginRight: "5px", verticalAlign: "-1px" }} />
            Date
          </label>
          <div style={{ display: "flex", gap: "6px" }}>
            <select value={form.month} onChange={set("month")} style={selectStyle} disabled={saving}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                </option>
              ))}
            </select>
            <select value={form.day} onChange={set("day")} style={selectStyle} disabled={saving}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={form.year}
              onChange={set("year")}
              style={{ ...selectStyle, width: "72px" }}
              min="2020"
              max="2100"
              disabled={saving}
            />
          </div>
        </div>

        <div>
          <label className="form-label">
            <Clock size={12} style={{ marginRight: "5px", verticalAlign: "-1px" }} />
            Time
          </label>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <select value={form.hour} onChange={set("hour")} style={selectStyle} disabled={saving}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span style={{ color: "var(--text-muted)" }}>:</span>
            <select value={form.minute} onChange={set("minute")} style={selectStyle} disabled={saving}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={form.meridiem}
              onChange={set("meridiem")}
              style={selectStyle}
              disabled={saving}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
          Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone || "local"}).
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSchedule} loading={saving}>
            Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}