import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the landing page hero and CTA", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Unearth new statements from the Magnus Institute.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Join the archive" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Be first to file a new statement." })
    ).toBeInTheDocument();
  });
});
