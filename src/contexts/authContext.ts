import { createContext } from "react";
import { User, Pet } from "@/types";

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  currentPet: Pet | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setIsAuthenticated: (value: boolean) => void;
  setCurrentPet: (pet: Pet) => void;
  updateUserProfile: (updates: Partial<User>) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  currentPet: null,
  login: () => Promise.resolve(false),
  register: () => Promise.resolve(false),
  logout: () => {},
  setIsAuthenticated: () => {},
  setCurrentPet: () => {},
  updateUserProfile: () => Promise.resolve(false),
});
// Re-export AuthProvider from the .tsx file
export { AuthProvider } from "./authContext.tsx";