import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nh_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const getMe = () => api.get('/bots/me');
export const renewBot = (botId) => api.post(`/bots/${botId}/renew`);
export const adminAddCoins = (userId, amount, reason) =>
  api.post(`/admin/users/${userId}/coins`, { amount, reason });
export const adminGetUserBots = (userId) => api.get(`/admin/users/${userId}/bots`);

export const getBotById = (botId) => api.get(`/bots/${botId}`);
export const getBotEnv = (botId) => api.get(`/bots/${botId}/env`);
export const saveBotEnv = (botId, vars) => api.put(`/bots/${botId}/env`, { vars });
export const uploadZip = (botId, formData) =>
  api.post(`/bots/${botId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getCoinTransactions = () => api.get('/bots/me/transactions');
