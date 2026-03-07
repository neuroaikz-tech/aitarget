import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    provider: string;
    created_at: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
    fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: false,

            setAuth: (user, token) => {
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                set({ user, token });
            },

            logout: () => {
                delete axios.defaults.headers.common['Authorization'];
                set({ user: null, token: null });
            },

            fetchMe: async () => {
                const { token } = get();
                if (!token) return;

                try {
                    set({ isLoading: true });
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const res = await axios.get(`${API_URL}/auth/me`);
                    set({ user: res.data.user, isLoading: false });
                } catch {
                    set({ user: null, token: null, isLoading: false });
                    delete axios.defaults.headers.common['Authorization'];
                }
            },
        }),
        {
            name: 'aitarget-auth',
            partialize: (state) => ({ token: state.token }),
        }
    )
);
