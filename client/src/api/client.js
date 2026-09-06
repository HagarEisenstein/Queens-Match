import axios from "axios";

const apiClient = axios.create({ baseURL: "/api" });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("queenb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getMentors(adviceTopics = []) {
  const searchParams = new URLSearchParams();
  adviceTopics.forEach((topic) => searchParams.append("adviceTopics", topic));
  const query = searchParams.toString();

  return apiClient.get(query ? `/mentors?${query}` : "/mentors");
}

export function verifyMentorSearchEmbedding(query) {
  return apiClient.post("/mentor-search/embedding", { query });
}

export default apiClient;
