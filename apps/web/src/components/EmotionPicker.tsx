import { useId, useMemo, useState } from "react";
import styles from "./EmotionPicker.module.css";

export type EmotionCategory = {
  id: string;
  label: string;
  icon: string;
  synonyms: string[];
};

export type SelectedEmotion = {
  categoryId: string;
  intensity: 0 | 1 | 2 | 3;
  selectedSynonyms: string[];
};

export type JournalEntryEmotions = {
  selected: SelectedEmotion[];
};

export type EmotionPickerProps = {
  categories?: EmotionCategory[];
  maxCategories?: number;
  maxSynonyms?: number;
  onChange?: (payload: JournalEntryEmotions) => void;
};

const DEFAULT_MAX_CATEGORIES = 5;
const DEFAULT_MAX_SYNONYMS = 3;

export const DEFAULT_EMOTION_CATEGORIES: EmotionCategory[] = [
  {
    id: "calm",
    label: "Calm",
    icon: "🫧",
    synonyms: ["Peaceful", "Relaxed", "Steady", "Grounded", "Balanced"],
  },
  {
    id: "joy",
    label: "Joy",
    icon: "😄",
    synonyms: ["Happy", "Delighted", "Playful", "Light", "Cheerful"],
  },
  {
    id: "grateful",
    label: "Grateful",
    icon: "🙏",
    synonyms: ["Thankful", "Appreciative", "Humbled", "Blessed"],
  },
  {
    id: "proud",
    label: "Proud",
    icon: "🏅",
    synonyms: ["Confident", "Self-assured", "Dignified", "Honored"],
  },
  {
    id: "capable",
    label: "Capable",
    icon: "🛠️",
    synonyms: ["Competent", "Able", "Prepared", "Skilled"],
  },
  {
    id: "connected",
    label: "Connected",
    icon: "🤝",
    synonyms: ["Loved", "Supported", "Seen", "Belonging"],
  },
  {
    id: "inspired",
    label: "Inspired",
    icon: "✨",
    synonyms: ["Motivated", "Curious", "Energized", "Imaginative"],
  },
  {
    id: "accomplished",
    label: "Accomplished",
    icon: "🏁",
    synonyms: ["Achieved", "Productive", "Effective", "Focused"],
  },
  {
    id: "surprised",
    label: "Surprised",
    icon: "😲",
    synonyms: ["Amazed", "Startled", "Awed", "Shocked"],
  },
  {
    id: "confused",
    label: "Confused",
    icon: "😵‍💫",
    synonyms: ["Unclear", "Unsure", "Perplexed", "Disoriented"],
  },
  {
    id: "ambivalent",
    label: "Ambivalent",
    icon: "😶",
    synonyms: ["Mixed", "Conflicted", "Torn", "Uncertain"],
  },
  {
    id: "apathetic",
    label: "Apathetic",
    icon: "🫥",
    synonyms: ["Detached", "Unmoved", "Numb", "Indifferent"],
  },
  {
    id: "anxious",
    label: "Anxious",
    icon: "😰",
    synonyms: ["Worried", "On edge", "Restless", "Uneasy"],
  },
  {
    id: "afraid",
    label: "Afraid",
    icon: "😨",
    synonyms: ["Scared", "Threatened", "Panicky", "Timid"],
  },
  {
    id: "angry",
    label: "Angry",
    icon: "😠",
    synonyms: ["Irritated", "Frustrated", "Enraged", "Agitated"],
  },
  {
    id: "sad",
    label: "Sad",
    icon: "😢",
    synonyms: ["Down", "Heavy", "Disappointed", "Hopeless"],
  },
  {
    id: "ashamed",
    label: "Ashamed",
    icon: "😳",
    synonyms: ["Guilty", "Embarrassed", "Remorseful", "Self-conscious"],
  },
  {
    id: "overwhelmed",
    label: "Overwhelmed",
    icon: "🫠",
    synonyms: ["Overloaded", "Stressed", "Swamped", "Burnt out"],
  },
  {
    id: "disgusted",
    label: "Disgusted",
    icon: "🤢",
    synonyms: ["Repelled", "Sickened", "Grossed out", "Aversion"],
  },
  {
    id: "lonely",
    label: "Lonely",
    icon: "🥺",
    synonyms: ["Isolated", "Left out", "Disconnected", "Abandoned"],
  },
  {
    id: "hurt",
    label: "Hurt",
    icon: "💔",
    synonyms: ["Betrayed", "Wounded", "Rejected", "Tender"],
  },
];

const intensityOptions: Array<{ value: 0 | 1 | 2 | 3; label: string }> = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

export function EmotionPicker({
  categories = DEFAULT_EMOTION_CATEGORIES,
  maxCategories = DEFAULT_MAX_CATEGORIES,
  maxSynonyms = DEFAULT_MAX_SYNONYMS,
  onChange,
}: EmotionPickerProps) {
  const [selected, setSelected] = useState<SelectedEmotion[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const detailsId = useId();

  const selectedById = useMemo(() => {
    return new Map(selected.map((entry) => [entry.categoryId, entry]));
  }, [selected]);

  const emitChange = (nextSelected: SelectedEmotion[]) => {
    onChange?.({ selected: nextSelected });
  };

  const handleToggleCategory = (categoryId: string) => {
    const isSelected = selectedById.has(categoryId);

    if (isSelected) {
      const nextSelected = selected.filter(
        (entry) => entry.categoryId !== categoryId
      );
      setSelected(nextSelected);
      setActiveCategoryId((prev) => (prev === categoryId ? null : prev));
      setValidationMessage(null);
      emitChange(nextSelected);
      return;
    }

    if (selected.length >= maxCategories) {
      setValidationMessage(`You can select up to ${maxCategories} categories.`);
      return;
    }

    const nextSelected = [
      ...selected,
      { categoryId, intensity: 0, selectedSynonyms: [] },
    ];
    setSelected(nextSelected);
    setActiveCategoryId(categoryId);
    setValidationMessage(null);
    emitChange(nextSelected);
  };

  const handleToggleSynonym = (categoryId: string, synonym: string) => {
    const current = selectedById.get(categoryId);
    if (!current) {
      return;
    }

    const hasSynonym = current.selectedSynonyms.includes(synonym);
    if (!hasSynonym && current.selectedSynonyms.length >= maxSynonyms) {
      setValidationMessage(
        `You can select up to ${maxSynonyms} words per category.`
      );
      return;
    }

    const nextSelected = selected.map((entry) => {
      if (entry.categoryId !== categoryId) {
        return entry;
      }
      const nextSynonyms = hasSynonym
        ? entry.selectedSynonyms.filter((item) => item !== synonym)
        : [...entry.selectedSynonyms, synonym];
      return { ...entry, selectedSynonyms: nextSynonyms };
    });

    setSelected(nextSelected);
    setValidationMessage(null);
    emitChange(nextSelected);
  };

  const handleIntensityChange = (
    categoryId: string,
    intensity: 0 | 1 | 2 | 3
  ) => {
    const nextSelected = selected.map((entry) => {
      if (entry.categoryId !== categoryId) {
        return entry;
      }
      return { ...entry, intensity };
    });
    setSelected(nextSelected);
    setValidationMessage(null);
    emitChange(nextSelected);
  };

  const activeCategory = categories.find(
    (category) => category.id === activeCategoryId
  );

  const activeSelection = activeCategory
    ? selectedById.get(activeCategory.id)
    : undefined;

  return (
    <section className={styles.wrapper} aria-label="Emotion picker">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>How are you feeling?</h2>
          <p className={styles.subtitle}>
            Choose up to {maxCategories} categories, then add optional words and
            intensity.
          </p>
        </div>
        <div className={styles.counter} aria-live="polite">
          {selected.length}/{maxCategories} selected
        </div>
      </header>

      <div className={styles.grid} role="list">
        {categories.map((category) => {
          const isSelected = selectedById.has(category.id);
          return (
            <button
              key={category.id}
              type="button"
              className={`${styles.iconButton} ${
                isSelected ? styles.iconButtonSelected : ""
              }`}
              onClick={() => handleToggleCategory(category.id)}
              onFocus={() => setActiveCategoryId(category.id)}
              aria-pressed={isSelected}
              aria-label={`${category.label} category`}
            >
              <span className={styles.icon} aria-hidden="true">
                {category.icon}
              </span>
              <span className={styles.iconLabel}>{category.label}</span>
            </button>
          );
        })}
      </div>

      {validationMessage ? (
        <p className={styles.validation} role="alert">
          {validationMessage}
        </p>
      ) : null}

      {activeCategory ? (
        <div
          className={styles.detailPanel}
          role="region"
          aria-labelledby={`${detailsId}-label`}
        >
          <div className={styles.detailHeader}>
            <div>
              <h3 id={`${detailsId}-label`} className={styles.detailTitle}>
                {activeCategory.icon} {activeCategory.label}
              </h3>
              <p className={styles.detailSubtitle}>
                Optional: choose up to {maxSynonyms} words.
              </p>
            </div>
            <span className={styles.selectionStatus}>
              {activeSelection ? "Selected" : "Not selected"}
            </span>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Words</p>
            <div className={styles.chipRow} role="list">
              {activeCategory.synonyms.map((synonym) => {
                const isSelected =
                  activeSelection?.selectedSynonyms.includes(synonym) ?? false;
                return (
                  <button
                    key={synonym}
                    type="button"
                    className={`${styles.chip} ${
                      isSelected ? styles.chipSelected : ""
                    }`}
                    onClick={() =>
                      handleToggleSynonym(activeCategory.id, synonym)
                    }
                    aria-pressed={isSelected}
                    aria-label={`${synonym} word`}
                    disabled={!activeSelection}
                  >
                    {synonym}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Intensity</p>
            <div className={styles.intensityRow} role="radiogroup">
              {intensityOptions.map((option) => {
                const isSelected = activeSelection?.intensity === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.intensityButton} ${
                      isSelected ? styles.intensityButtonSelected : ""
                    }`}
                    onClick={() =>
                      handleIntensityChange(activeCategory.id, option.value)
                    }
                    aria-pressed={isSelected}
                    aria-label={`${activeCategory.label} intensity ${option.label}`}
                    disabled={!activeSelection}
                  >
                    <span className={styles.dotRow} aria-hidden="true">
                      {Array.from({ length: option.value || 1 }).map(
                        (_, index) => (
                          <span
                            key={`${option.value}-${index}`}
                            className={styles.dot}
                          />
                        )
                      )}
                    </span>
                    <span className={styles.intensityLabel}>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.detailPanelEmpty}>
          <p className={styles.detailSubtitle}>
            Select a category to reveal words and intensity controls.
          </p>
        </div>
      )}
    </section>
  );
}
