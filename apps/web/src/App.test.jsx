import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the header and a disabled search button by default", () => {
    render(<App />);

    expect(screen.getByText("Search the Magnus index")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
  });

  it("fetches answers and renders the response", async () => {
    const response = {
      answer: "Here is the answer.",
      citations: [],
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    render(<App />);

    await screen.findByLabelText("Search query");

    const queryInput = screen.getByLabelText("Search query");
    fireEvent.change(queryInput, { target: { value: "onboarding checklist" } });

    const submitButton = screen.getByRole("button", { name: "Search" });
    fireEvent.click(submitButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/answer?q=onboarding%20checklist&topK=8"
      )
    );

    expect(await screen.findByText("Here is the answer.")).toBeInTheDocument();
  });
});
