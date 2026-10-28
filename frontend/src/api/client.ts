import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string; errors?: Array<{ field: string; message: string }> }>) => {
    const data = error.response?.data;
    const customError: ApiError = {
      message:
        data?.message ||
        data?.error ||
        error.message ||
        'An unexpected error occurred. Please try again.',
      statusCode: error.response?.status,
      errors: data?.errors,
    };
    return Promise.reject(customError);
  }
);

export default apiClient;
