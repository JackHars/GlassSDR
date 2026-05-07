import { useState } from "react";
import { RecordButton } from "./RecordButton";
import { RecordingsPanel } from "./RecordingsPanel";
import type { AppId } from "../ipc/types/AppId";
import type { RecordingFormat } from "../ipc/types/RecordingFormat";

interface Props {
  appId: AppId;
  format: RecordingFormat;
  centerHz?: number;
}

/** Convenience wrapper: RecordButton + RecordingsPanel, with the panel auto-refreshing on save. */
export function RecordBar({ appId, format, centerHz }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div style={{ marginTop: 8 }}>
      <RecordButton
        appId={appId}
        format={format}
        centerHz={centerHz}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
      <RecordingsPanel appId={appId} refreshKey={refreshKey} />
    </div>
  );
}
