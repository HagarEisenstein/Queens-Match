import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import NotificationBell from "./NotificationBell";
import { useNotifications } from "./NotificationContext";

jest.mock("./NotificationContext", () => ({ useNotifications: jest.fn() }));

test("exposes unread count and an accessible mark-as-read action", () => {
  const markRead = jest.fn();
  useNotifications.mockReturnValue({
    notifications: [{ id: "n1", title: "Meeting scheduled", message: "Choose a time", readAt: null }],
    unreadCount: 1,
    markRead,
    openNotification: jest.fn(),
  });

  render(<NotificationBell />);
  fireEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Meeting scheduled as read" }));
  expect(markRead).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
});

test("opens a notification when its menu item is clicked", () => {
  const openNotification = jest.fn();
  const notification = {
    id: "n2",
    title: "Leave feedback",
    message: "Please rate your meeting",
    readAt: null,
    actionUrl: "/meetings/m1/feedback",
  };
  useNotifications.mockReturnValue({
    notifications: [notification],
    unreadCount: 1,
    markRead: jest.fn(),
    openNotification,
  });

  render(<NotificationBell />);
  fireEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));
  fireEvent.click(screen.getByText("Leave feedback"));
  expect(openNotification).toHaveBeenCalledWith(notification);
});
