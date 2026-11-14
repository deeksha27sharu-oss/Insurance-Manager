import axios from "axios";
const BASE_URL = "/api";

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache", },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  if (config.method === "get") {
    config.params = { ...config.params, _t: Date.now() };
  }
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (process.env.NODE_ENV === "development") {
    console.log(`${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    if (process.env.NODE_ENV === "development") {
      console.error(`${error.config?.method?.toUpperCase()} ${url}`, status, error.response?.data);
    }
    const isAuthEntry =
      url.includes("/auth/login") || url.includes("/auth/signup");
    const isRefresh = url.includes("/auth/refresh");

    if (status === 401 && !isAuthEntry && !isRefresh && !url.includes("/auth/me")) {
      window.dispatchEvent(new Event("auth:expired"));
    }

    return Promise.reject(error);
  }
);

function getErrorMessage(err, method, path) {
  const status = err.response?.status;
  const backendMsg = err.response?.data?.message || err.response?.data?.error;
  if (backendMsg) return backendMsg;
  if (err.code === "ECONNABORTED") return `Request timed out (${method} ${path})`;
  if (!err.response) return `Network error — is the backend running?`;
  return `${method} ${path} failed: ${status}`;
}

export async function apiGet(path) {
  try { return (await apiClient.get(path)).data; } catch (err) { throw new Error(getErrorMessage(err, "GET", path)); }
}
export async function apiPost(path, body) {
  try { return (await apiClient.post(path, body)).data; } catch (err) { throw new Error(getErrorMessage(err, "POST", path)); }
}
export async function apiPut(path, body) {
  try { return (await apiClient.put(path, body)).data; } catch (err) { throw new Error(getErrorMessage(err, "PUT", path)); }
}
export async function apiDelete(path) {
  try { return (await apiClient.delete(path)).data; } catch (err) { throw new Error(getErrorMessage(err, "DELETE", path)); }
}