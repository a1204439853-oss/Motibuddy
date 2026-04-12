import { useState, ReactNode, useEffect } from "react";
import { User, Pet } from "@/types";
import { AuthContext } from "./authContext";

// Mock implementation for bcrypt
const mockHash = async (password: string): Promise<string> => {
  // Simple mock hashing for development
  return `hashed_${password}`;
};

const mockCompare = async (password: string, hash: string): Promise<boolean> => {
  // Simple mock comparison for development
  return hash === `hashed_${password}`;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Mock implementation for AuthProvider
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPet, setCurrentPet] = useState<Pet | null>(null);
  
  // Initialize authentication state
  useEffect(() => {
    // No longer clearing all localStorage data on initialization
    // This allows pet data and other user data to persist
  }, []);
  

  const login = async (identifier: string, password: string): Promise<boolean> => {
    try {
      // Mock implementation using localStorage
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      // Find user by either username or email
      const user = users.find((u: any) => u.username === identifier || u.email === identifier);
      
      if (user && await mockCompare(password, user.password)) {
        setIsAuthenticated(true);
        setCurrentUser(user);
        
        // Store current user ID in localStorage for data isolation
        localStorage.setItem('currentUserId', user.id);
        
        // Load pet if exists
        let userPet = null;
        
        // Try to load from pet_${userId}
        const petData = localStorage.getItem(`pet_${user.id}`);
        if (petData) {
          try {
            userPet = JSON.parse(petData);
          } catch (error) {
            console.error(`Error parsing pet_${user.id}:`, error);
          }
        }
        
        // If not found, try loading from currentPet
        if (!userPet) {
          const currentPetData = localStorage.getItem("currentPet");
          if (currentPetData) {
            try {
              const pet = JSON.parse(currentPetData);
              if (pet.userId === user.id) {
                userPet = pet;
              }
            } catch (error) {
              console.error("Error parsing currentPet:", error);
            }
          }
        }
        
        // If found, set current pet
        if (userPet) {
          setCurrentPet(userPet);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      // Load existing users instead of clearing them
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      
      // Check if username or email already exists
      const existingUser = users.find((u: any) => u.username === username || u.email === email);
      if (existingUser) {
        console.error("Username or email already exists");
        return false;
      }
      
      // Hash password
      const hashedPassword = await mockHash(password);
      
      // Create new user
      const newUser: User = {
        id: Date.now().toString(),
        username,
        email,
        password: hashedPassword,
        avatar: undefined, // No default avatar, will use pet image
        createdAt: new Date().toISOString(),
        achievements: []
      };
      
      // Save to localStorage - append to existing users
      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));
      
      // Auto login after registration
      setIsAuthenticated(true);
      setCurrentUser(newUser);
      
      // Store current user ID in localStorage for data isolation
      localStorage.setItem('currentUserId', newUser.id);
      
      return true;
    } catch (error) {
      console.error("Registration error:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentPet(null);
    // Clear any authentication-related data from localStorage
    localStorage.removeItem('currentPet');
    // Clear current user ID to prevent data leakage between users
    localStorage.removeItem('currentUserId');
    // 触发登出事件，通知其他组件（如小组件）隐藏
    window.dispatchEvent(new CustomEvent('user-logout'));
  };

  const updateUserProfile = async (updates: Partial<User>): Promise<boolean> => {
    try {
      if (!currentUser) return false;
      
      // Update user in localStorage
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const userIndex = users.findIndex((u: any) => u.id === currentUser.id);
      
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        localStorage.setItem("users", JSON.stringify(users));
        
        // Update current user state
        setCurrentUser({ ...currentUser, ...updates });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Update profile error:", error);
      return false;
    }
  };

  const contextValue = {
    isAuthenticated,
    currentUser,
    currentPet,
    login,
    register,
    logout,
    setIsAuthenticated,
    setCurrentPet,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};