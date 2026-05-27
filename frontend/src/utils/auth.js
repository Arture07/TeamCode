export const getAuthHeaders = () => {
  const token = localStorage.getItem("jwtToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};
