import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('oau_tracker_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and not already on login, clear token
      const isLogin = window.location.pathname === '/login';
      if (!isLogin) {
        localStorage.removeItem('oau_tracker_token');
        localStorage.removeItem('oau_tracker_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
