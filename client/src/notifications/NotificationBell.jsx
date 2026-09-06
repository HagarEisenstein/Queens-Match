import React, { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DoneIcon from "@mui/icons-material/Done";
import { useNotifications } from "./NotificationContext";

export default function NotificationBell() {
  const [anchor, setAnchor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { notifications, unreadCount, markRead, openNotification, respondToAdminInvite } = useNotifications();

  const handleInviteAction = async (notification, action) => {
    setBusyId(`${notification.id}:${action}`);
    try {
      await respondToAdminInvite(notification.id, action);
    } finally {
      setBusyId(null);
    }
  };

  const inviteStatusLabel = (status) => {
    if (status === "accepted") return "Accepted";
    if (status === "declined") return "Declined";
    return "Pending";
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton color="inherit" aria-label={`${unreadCount} unread notifications`} onClick={(event) => setAnchor(event.currentTarget)} sx={{ color: "primary.main" }}>
          <Badge badgeContent={unreadCount} color="secondary"><NotificationsIcon /></Badge>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} MenuListProps={{ "aria-label": "Notifications" }}>
        {notifications.length === 0 && <MenuItem disabled>No notifications</MenuItem>}
        {notifications.map((notification) => (
          <MenuItem
            key={notification.id}
            selected={!notification.readAt}
            onClick={notification.type === "ADMIN_INVITE" ? undefined : () => openNotification(notification)}
            sx={{ maxWidth: 360, gap: 1, alignItems: "flex-start" }}
          >
            <Stack spacing={1} sx={{ width: "100%" }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "space-between" }}>
                <ListItemText
                  primary={notification.title}
                  secondary={notification.message}
                  primaryTypographyProps={{ fontWeight: notification.readAt ? 400 : 500 }}
                  secondaryTypographyProps={{ sx: { whiteSpace: "normal" } }}
                  sx={{ my: 0 }}
                />
                {notification.type === "ADMIN_INVITE" && (
                  <Chip size="small" label={inviteStatusLabel(notification.status)} color={notification.status === "accepted" ? "success" : notification.status === "declined" ? "default" : "warning"} />
                )}
              </Box>
              {notification.type === "ADMIN_INVITE" && notification.status === "pending" ? (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleInviteAction(notification, "accept");
                    }}
                    disabled={Boolean(busyId)}
                  >
                    {busyId === `${notification.id}:accept` ? "Accepting..." : "Accept"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleInviteAction(notification, "decline");
                    }}
                    disabled={Boolean(busyId)}
                  >
                    {busyId === `${notification.id}:decline` ? "Declining..." : "Decline"}
                  </Button>
                </Stack>
              ) : null}
            </Stack>
            {!notification.readAt && notification.type !== "ADMIN_INVITE" && (
              <Box>
                <IconButton
                  size="small"
                  aria-label={`Mark ${notification.title} as read`}
                  onClick={(event) => { event.stopPropagation(); markRead(notification); }}
                >
                  <DoneIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </MenuItem>
        ))}
        {notifications.length > 0 && <Typography variant="caption" sx={{ display: "block", px: 2, py: 1 }}>Showing the latest 50 notifications</Typography>}
      </Menu>
    </>
  );
}
