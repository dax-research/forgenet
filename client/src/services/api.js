import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  // No default Content-Type here on purpose. Setting application/json globally
  // forced that header onto FormData uploads too, so the multipart boundary was
  // never sent and multer never received the file. Letting axios set the
  // Content-Type per request is correct for both JSON and multipart.
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // JSON bodies get an explicit type; FormData must be left alone so the
    // browser can attach the multipart boundary.
    const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;
    if (!isFormData && config.data !== undefined && !config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }
    if (isFormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and not on auth pages, remove expired token
      if (
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  }
);

export default api;