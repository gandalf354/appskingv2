import { create } from 'zustand';
import { AuthState, User, LoginRequest, RegisterRequest } from '@/types';
import apiClient from '@/lib/api';
import { toast } from 'react-hot-toast';

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: { email: string; name: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isLoading: false,
  error: null,

  // Actions
  login: async (credentials: LoginRequest) => {
    console.log('🔄 Starting login process with:', { username: credentials.username });
    set({ isLoading: true, error: null });
    
    try {
      console.log('🌐 Making API request to:', '/auth/login');
      const response = await apiClient.post<{
        message: string;
        token: string;
        user: User;
      }>('/auth/login', credentials);

      console.log('✅ API response received:', response);
      const { token, user } = response;
      
      // Store token in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        console.log('💾 Stored token and user in localStorage');
      }
      
      set({ 
        user, 
        token, 
        isLoading: false, 
        error: null 
      });

      console.log('🎉 Login successful, updating store');
      toast.success('Login successful!');
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || 'Login failed';
      set({ 
        user: null, 
        token: null, 
        isLoading: false, 
        error: errorMessage 
      });
      toast.error(errorMessage);
    }
  },

  register: async (userData: RegisterRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      await apiClient.post('/auth/register', userData);
      
      set({ isLoading: false, error: null });
      toast.success('Registration successful! Please login.');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      set({ isLoading: false, error: errorMessage });
      toast.error(errorMessage);
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    
    set({ 
      user: null, 
      token: null, 
      isLoading: false, 
      error: null 
    });
    
    toast.success('Logged out successfully');
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  checkAuth: async () => {
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      set({ user: null, token: null });
      return;
    }

    try {
      const user = JSON.parse(userData);
      set({ user, token, isLoading: false, error: null });
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null, isLoading: false, error: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  updateProfile: async (data: { email: string; name: string }) => {
    set({ isLoading: true, error: null });
    
    try {
      await apiClient.put('/auth/profile', data);
      
      // Update user in state
      const currentUser = get().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, ...data };
        set({ user: updatedUser, isLoading: false });
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
      
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update profile';
      set({ isLoading: false, error: errorMessage });
      toast.error(errorMessage);
    }
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    set({ isLoading: true, error: null });
    
    try {
      await apiClient.put('/auth/change-password', data);
      
      set({ isLoading: false });
      toast.success('Password changed successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      set({ isLoading: false, error: errorMessage });
      toast.error(errorMessage);
    }
  },
}));