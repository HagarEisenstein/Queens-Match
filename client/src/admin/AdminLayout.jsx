import React from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { Link, Outlet, useLocation } from "react-router-dom";

const tabs = [
  { label: "Meetings", to: "/admin" },
  { label: "Calendar", to: "/admin/calendar" },
  { label: "Users", to: "/admin/users" },
  { label: "Alerts", to: "/admin/alerts" },
];

export default function AdminLayout() {
  const location = useLocation();
  const current =
    tabs
      .slice()
      .reverse()
      .find((tab) => location.pathname.startsWith(tab.to))?.to || "/admin";

  return (
    <Box>
      <Tabs value={current} sx={{ mb: 3 }}>
        {tabs.map((tab) => (
          <Tab
            key={tab.to}
            value={tab.to}
            label={tab.label}
            component={Link}
            to={tab.to}
          />
        ))}
      </Tabs>
      <Outlet />
    </Box>
  );
}
