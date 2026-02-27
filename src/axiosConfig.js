
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const originalRequest = error.config;

        // Skip interceptor if the request already failed once OR if it's the refresh/login endpoint
        // This is CRITICAL to prevent infinite loops and redundant calls
        if (
            originalRequest._retry ||
            originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/login')
        ) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => {
                        originalRequest._retry = true;
                        return api(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            return new Promise(function (resolve, reject) {
                // Use baseline axios to avoid interceptors for the refresh call
                axios.post('http://localhost:5000/api/auth/refresh', {}, { withCredentials: true })
                    .then(() => {
                        isRefreshing = false;
                        processQueue(null);
                        resolve(api(originalRequest));
                    })
                    .catch((err) => {
                        isRefreshing = false;
                        processQueue(err);
                        reject(err);
                    });
            });
        }

        return Promise.reject(error);
    }
);

export default api;
