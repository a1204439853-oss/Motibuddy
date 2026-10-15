import { createContext } from "react";
import { User, Pet } from "@/types";

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  currentPet: Pet | null;
  sessionVersion: number;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  createPet: (pet: Pet) => Promise<void>;
  updatePet: (change: (pet: Pet) => Pet) => Promise<Pet>;
  updateUserProfile: (updates: Partial<User>) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  currentPet: null,
  sessionVersion: 0,
  login: () => Promise.resolve(false),
  register: () => Promise.resolve(false),
  logout: () => {},
  createPet: async () => {},
  updatePet: async () => { throw new Error('Sign in before updating a pet.'); },
  updateUserProfile: () => Promise.resolve(false),
});
// Re-export AuthProvider from the .tsx file
export { AuthProvider } from "./authContext.tsx";
