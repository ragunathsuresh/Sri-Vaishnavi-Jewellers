
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
            } catch (error) {
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
            // Get CSRF token first (if needed, but csurf with cookie handles it usually? 
            // no, we need to send it in header if configured that way.
            // But with csurf + cookie:true, it expects X-XSRF-TOKEN header which axios reads from cookie if configured.
            // Let's check csurf config. We used cookie: true. 
            // So client needs to read XSRF-TOKEN cookie and send it as header.
            // Axios does this automatically if xsrfCookieName is set.
            // express csurf defaults: cookie key '_csrf' (if stored in cookie), 
            // but value is also sent in response. 
            // Wait, standard csurf with cookie:true expects token in 'X-XSRF-TOKEN' header 
            // and the secret in the cookie.

            // Let's fetch CSRF token manually to be safe
            const { data: { csrfToken } } = await api.get('/auth/csrf-token');
            api.defaults.headers.common['X-CSRF-Token'] = csrfToken;

            const { data } = await api.post('/auth/login', { email, password });
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
