import axios from 'axios';

const cleaned = String(import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '');
const baseURL = !cleaned ? '/api' : (cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`);

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT auth token
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('sg_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle errors
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sg_token');
    }
  }
  return Promise.reject(error);
});

export default api;
