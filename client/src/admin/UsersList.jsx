import React, { useEffect, useState } from "react";
import {
  Alert,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import api from "../api";

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/users")
      .then(({ data }) => setUsers(data.users))
      .catch((requestError) =>
        setError(
          requestError.response?.data?.error?.message ||
            "Users could not be loaded."
        )
      );
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Users
      </Typography>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Mentoring meetings</TableCell>
              <TableCell>Mentee meetings</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <MuiLink component={Link} to={`/admin/users/${user.id}`}>
                    {user.username}
                  </MuiLink>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.roles.join(", ")}</TableCell>
                <TableCell>{user.mentorMeetingCount}</TableCell>
                <TableCell>{user.menteeMeetingCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </>
  );
}
