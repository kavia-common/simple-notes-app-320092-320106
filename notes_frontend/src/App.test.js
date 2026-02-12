import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the Notes app shell", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "Notes" })).toBeInTheDocument();
  expect(screen.getByRole("main", { name: /notes app content/i })).toBeInTheDocument();
});
