import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmotionPicker } from "./EmotionPicker";

afterEach(() => {
  cleanup();
});

const selectCategory = (label: string) => {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`${label} category`, "i") })
  );
};

const selectWord = (word: string) => {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`${word} word`, "i") })
  );
};

const selectIntensity = (label: string) => {
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`intensity ${label}`, "i"),
    })
  );
};

describe("EmotionPicker", () => {
  it("enforces the max category cap", () => {
    render(<EmotionPicker />);

    ["Calm", "Joy", "Grateful", "Proud", "Capable"].forEach(selectCategory);

    selectCategory("Connected");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You can select up to 5 categories."
    );
    expect(
      screen.getByRole("button", { name: /Connected category/i })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("enforces the max synonym cap per category", () => {
    render(<EmotionPicker />);

    selectCategory("Calm");
    ["Peaceful", "Relaxed", "Steady"].forEach(selectWord);

    selectWord("Grounded");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You can select up to 3 words per category."
    );
    expect(
      screen.getByRole("button", { name: /Grounded word/i })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the selected structure on change", () => {
    const handleChange = vi.fn();
    render(<EmotionPicker onChange={handleChange} />);

    selectCategory("Joy");
    selectWord("Happy");
    selectIntensity("Medium");

    const lastPayload = handleChange.mock.calls.at(-1)?.[0];

    expect(lastPayload).toEqual({
      selected: [
        {
          categoryId: "joy",
          intensity: 2,
          selectedSynonyms: ["Happy"],
        },
      ],
    });
  });
});
