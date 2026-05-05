import { createContext, useState, useContext, useEffect } from 'react';
import { stageClient } from '@/api/stageClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [authError, setAuthError]             = useState(null);

  // isLoadingPublicSettings kept for backward-compat with App.jsx — always false
  const isLoadingPublicSettings = false;
  const appPublicSettings       = null;

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    if (!stageClient.auth.hasToken()) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      return;
    }
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await stageClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    stageClient.auth.logout(shouldRedirect ? '/' : undefined);
  };

  const navigateToLogin = () => {
    stageClient.auth.redirectToLogin();
  };

  // Legacy alias kept for backward-compat
  const checkAppState = checkUserAuth;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
