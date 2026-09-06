import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Button, Snackbar } from "@mui/material";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth/AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token, isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    const { data } = await api.get("/notifications");
    setNotifications(data);
  }, [isAuthenticated]);

  const updateLocally = useCallback((id, changes) => {
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }, []);

  const markRead = useCallback(async (notification) => {
    if (!notification.readAt) {
      await api.patch(`/notifications/${notification.id}/read`);
      updateLocally(notification.id, { readAt: new Date().toISOString() });
    }
  }, [updateLocally]);

  const openNotification = useCallback(async (notification) => {
    await markRead(notification);
    setPopup(null);
    if (notification.actionUrl) navigate(notification.actionUrl);
  }, [markRead, navigate]);

  const markActionCompleted = useCallback(async (notificationId) => {
    await api.patch(`/notifications/${notificationId}/action-completed`);
    const completedAt = new Date().toISOString();
    updateLocally(notificationId, { readAt: completedAt, actionCompletedAt: completedAt });
  }, [updateLocally]);

  const respondToAdminInvite = useCallback(async (notificationId, action) => {
    const endpoint =
      action === "accept" ? "accept-admin" : "decline-admin";
    const { data } = await api.post(`/notifications/${notificationId}/${endpoint}`);
    const completedAt = new Date().toISOString();
    updateLocally(notificationId, {
      status: data.status,
      readAt: completedAt,
      actionCompletedAt: completedAt,
    });
    if (action === "accept") {
      await refreshUser();
    }
    return data;
  }, [refreshUser, updateLocally]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setPopup(null);
      return;
    }
    loadNotifications().catch(() => {});
  }, [isAuthenticated, loadNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;
    const controller = new AbortController();
    let reconnectTimer;

    async function connect() {
      try {
        const response = await fetch("/api/notifications/stream", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("Notification stream unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          for (const block of blocks) {
            const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            const notification = JSON.parse(dataLine.slice(6));
            setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
            if (notification.popupEligible !== false) setPopup(notification);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => { controller.abort(); clearTimeout(reconnectTimer); };
  }, [isAuthenticated, token]);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
    markRead,
    openNotification,
    markActionCompleted,
    respondToAdminInvite,
    refresh: loadNotifications,
  }), [notifications, markRead, openNotification, markActionCompleted, respondToAdminInvite, loadNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar open={Boolean(popup)} autoHideDuration={7000} onClose={() => setPopup(null)}>
        <Alert
          severity="info"
          role="status"
          action={popup?.actionUrl ? <Button color="inherit" size="small" onClick={() => openNotification(popup)}>Open</Button> : undefined}
          onClose={() => setPopup(null)}
        >
          {popup?.title}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
