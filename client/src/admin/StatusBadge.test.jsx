import React from "react";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

test("renders the shared status label", () => {
  render(<StatusBadge status="pending_mentor_times" />);
  expect(screen.getByText("Waiting for mentor times")).toBeInTheDocument();
});

test("falls back to the raw value for an unknown status", () => {
  render(<StatusBadge status="some_future_status" />);
  expect(screen.getByText("some_future_status")).toBeInTheDocument();
});
