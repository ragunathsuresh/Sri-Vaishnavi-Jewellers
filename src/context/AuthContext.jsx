
import React, { createContext, useState, useEffect } from 'react';
import api from '../axiosConfig';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial check for user (e.g., if page reloaded)
    // For now, we'll rely on the protected route logic to check backend validity
    // or we could add a /me endpoint. To keep it simple, we initialize loading to false
    // and let the login process handle setting the user. 
    // Ideally, we'd have a /api/auth/me endpoint to persist session on reload.
    // Given the requirements, I'll add a check function.

    useEffect(() => {
        // Since we use HttpOnly cookies, we can't read token in JS.
        // We'll trust the cookies are there or not.
        // A real app would verify session on mount. 
        // For this demo, let's assume if we have a refresh token we are good?
        // No, let's just default to null and rely on login for now.
        // Or better, let's try to refresh the token on mount to see if we are logged in.

        const checkAuth = async () => {
            console.log('[AuthContext] Checking authentication...');
            try {
                // Try to refresh token which also sets new access token cookie
                // We use api.post but the interceptor will shield from loops
                await api.post('/auth/refresh');

                const storedUser = localStorage.getItem('userInfo');
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    console.log('[AuthContext] User restored from storage:', parsedUser.name);
                }
            } catch {
                console.log('[AuthContext] Authentication check failed or no session');
                setUser(null);
                localStorage.removeItem('userInfo');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);


    const login = async (email, password) => {
        try {
            // Attempt login directly first. Some deployments do not require the CSRF preflight for this route.
            let data;
            try {
                const response = await api.post('/auth/login', { email, password });
                data = response.data;
            } catch (error) {
                // If backend expects a CSRF header/cookie pair, fetch token and retry once.
                if (error.response?.status === 403) {
                    const csrfRes = await api.get('/auth/csrf-token');
                    const csrfToken = csrfRes?.data?.csrfToken;
                    if (csrfToken) {
                        api.defaults.headers.common['X-CSRF-Token'] = csrfToken;
                    }
                    const retryResponse = await api.post('/auth/login', { email, password });
                    data = retryResponse.data;
                } else {
                    throw error;
                }
            }
            setUser(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
            setUser(null);
            localStorage.removeItem('userInfo');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
