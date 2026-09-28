import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/auth.service";
import { usersService } from "../services/users.service";
import { socketService } from "../services/socket.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // Initialize and check current user
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const savedToken = localStorage.getItem("token");
      if (!savedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await authService.getMe();
        if (isMounted && res.success && res.data?.user) {
          setUser(res.data.user);
          localStorage.setItem("user", JSON.stringify(res.data.user));
          socketService.connect(savedToken);
        }
      } catch (err) {
        console.warn("Auth check failed:", err.message);
        if (isMounted) {
          setUser(null);
          setToken(null);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          socketService.disconnect();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.success && res.data) {
      const { token: newToken, user: userData } = res.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
      socketService.connect(newToken);
      return res;
    }
    throw new Error(res.message || "Login failed");
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    return res;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignored
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      socketService.disconnect();
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authService.getMe();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        return res.data.user;
      }
    } catch (err) {
      console.warn("Refresh user error:", err.message);
    }
    return null;
  };

  const updateProfile = async (data) => {
    if (!user?._id) return null;
    const res = await usersService.updateUser(user._id, data);
    if (res.success && res.data?.user) {
      setUser(res.data.user);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      return res.data.user;
    }
    return null;
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
