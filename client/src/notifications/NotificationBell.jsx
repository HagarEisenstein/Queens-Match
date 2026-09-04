import React, { useState } from "react";
import { Badge, Box, IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DoneIcon from "@mui/icons-material/Done";
import { useNotifications } from "./NotificationContext";

export default function NotificationBell() {
  const [anchor, setAnchor] = useState(null);
  const { notifications, unreadCount, markRead, openNotification } = useNotifications();

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
          <MenuItem key={notification.id} selected={!notification.readAt} onClick={() => openNotification(notification)} sx={{ maxWidth: 360, gap: 1 }}>
            <ListItemText
              primary={notification.title}
              secondary={notification.message}
              primaryTypographyProps={{ fontWeight: notification.readAt ? 400 : 500 }}
              secondaryTypographyProps={{ sx: { whiteSpace: "normal" } }}
            />
            {!notification.readAt && (
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
