import axios from "axios";

const apiClient = axios.create({ baseURL: "/api" });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("queenb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function verifyMentorSearchEmbedding(query) {
  return apiClient.post("/mentor-search/embedding", { query });
}

export function searchMentors(query) {
  return apiClient.post("/mentor-search", { query });
}

export default apiClient;
