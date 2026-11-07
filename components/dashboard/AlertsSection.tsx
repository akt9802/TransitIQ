"use client";

import { useState } from "react";
import { Alert, SectionCard, useFleetSave } from "@/components/dashboard/frame";
import { primaryBtn } from "@/components/dashboard/styles";
import { ALERT_CHANNELS, ALERT_KINDS, type NotificationPreference } from "@/lib/company/types";

export default function AlertsSection({ saved }: { saved: NotificationPreference[] }) {
  const { error, saving, submit } = useFleetSave();
  const [items, setItems] = useState(() =>
    ALERT_KINDS.flatMap((kind) =>
      ALERT_CHANNELS.map((channel) => ({
        kind: kind.key,
        channel: channel.key,
        enabled: saved.find((row) => row.kind === kind.key && row.channel === channel.key)?.enabled ?? false,
      }))
    )
  );

  function toggle(kind: string, channel: string) {
    setItems((current) =>
      current.map((item) =>
        item.kind === kind && item.channel === channel ? { ...item, enabled: !item.enabled } : item
      )
    );
  }

  return (
    <SectionCard title="Alerts" caption="Choose which messages you want, and where they should arrive.">
      <Alert message={error} />
      <form
        className="mt-4 overflow-x-auto"
        onSubmit={async (e) => {
          e.preventDefault();
          await submit("/api/company/notifications", "PUT", { items });
        }}
      >
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-muted">
              <th className="py-2 pr-4 font-bold">Alert</th>
              {ALERT_CHANNELS.map((channel) => (
                <th key={channel.key} className="py-2 pr-4 font-bold">{channel.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALERT_KINDS.map((kind) => (
              <tr key={kind.key} className="border-b border-ink/15">
                <td className="py-3 pr-4">{kind.label}</td>
                {ALERT_CHANNELS.map((channel) => {
                  const on = items.find((item) => item.kind === kind.key && item.channel === channel.key)?.enabled ?? false;
                  return (
                    <td key={channel.key} className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={on}
                        aria-label={`${kind.label} by ${channel.label}`}
                        onChange={() => toggle(kind.key, channel.key)}
                        className="h-4 w-4 accent-ink"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <button type="submit" className={`${primaryBtn} mt-4`} disabled={saving}>
          {saving ? "Saving…" : "Save alerts"}
        </button>
      </form>
    </SectionCard>
  );
}
