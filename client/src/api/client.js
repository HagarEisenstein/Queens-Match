import axios from "axios";

const apiClient = axios.create({ baseURL: "/api" });

apiClient.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(localStorage.getItem("queens-match-session"));
    if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  } catch {
    // An absent or malformed local session is treated as logged out.
  }
  return config;
});

export default apiClient;
