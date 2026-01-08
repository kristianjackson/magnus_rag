import { useState } from "react";
import {
  EmotionPicker,
  type JournalEntryEmotions,
} from "./EmotionPicker";

export function EmotionPickerExample() {
  const [payload, setPayload] = useState<JournalEntryEmotions>({ selected: [] });

  const handleSave = () => {
    const serialized = JSON.stringify(payload, null, 2);
    window.localStorage.setItem("journal-entry-emotions", serialized);
  };

  return (
    <section>
      <EmotionPicker onChange={setPayload} />
      <div style={{ marginTop: "16px" }}>
        <button type="button" onClick={handleSave}>
          Save feelings
        </button>
      </div>
      <pre aria-label="Serialized emotions payload">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </section>
  );
}
