import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setCsrfToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshMe = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const payload = res.data?.data;
      setUser(payload?.user || null);
      if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
      setUnreadNotifications(payload?.unreadNotifications || 0);
      setUnreadMessages(payload?.unreadMessages || 0);
      return payload?.user || null;
    } catch {
      setUser(null);
      setUnreadNotifications(0);
      setUnreadMessages(0);
      try {
        const csrfRes = await api.get('/auth/csrf-token');
        if (csrfRes.data?.data?.csrfToken) setCsrfToken(csrfRes.data.data.csrfToken);
      } catch {
        // Ignore offline initial fetch
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    const { user: loggedInUser, csrfToken } = res.data.data;
    if (csrfToken) setCsrfToken(csrfToken);
    setUser(loggedInUser);
    await refreshMe();
    return res.data;
  }, [refreshMe]);

  const register = useCallback(async (formData) => {
    const res = await api.post('/auth/register', formData);
    const { user: registeredUser, csrfToken } = res.data.data;
    if (csrfToken) setCsrfToken(csrfToken);
    setUser(registeredUser);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setUnreadNotifications(0);
      setUnreadMessages(0);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        logout,
        refreshMe,
        unreadNotifications,
        setUnreadNotifications,
        unreadMessages,
        setUnreadMessages,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

