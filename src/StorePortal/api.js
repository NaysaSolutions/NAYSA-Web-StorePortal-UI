const trimTrailingSlashes = (value) => String(value || "").replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api",
);

export const apiUrl = (path) => {
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const withQuery = (endpoint, params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
      return;
    }

    query.append(key, String(value));
  });

  const queryString = query.toString();
  if (!queryString) return apiUrl(endpoint);

  return `${apiUrl(endpoint)}${String(endpoint).includes("?") ? "&" : "?"}${queryString}`;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with status ${response.status}.`);
    error.response = {
      status: response.status,
      data,
    };
    throw error;
  }

  return data;
};

export const fetchData = (endpoint, params) => requestJson(withQuery(endpoint, params));

export const postRequest = (endpoint, payload) =>
  requestJson(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });
