import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { User, Pet } from '@/types';
import { AuthContext } from './authContext';
import { petRepository, businessRepository, initializeBusiness } from '@/services/storage';
import { decodePet } from '@/services/petData';
import { SessionEpoch } from '@/services/sessionEpoch';
import { clearRuntimeSession } from '@/services/runtimeSession';
import { PetRecoveryDialog } from '@/components/pet/PetRecoveryDialog';
import type { PetLoad, PetSource } from '@/services/petRepository';

type Conflict = Extract<PetLoad, { status: 'conflict' }>;
interface PendingRecovery { user: User; version: number; conflict: Conflict }

// Password storage is still the legacy format; its replacement is a separate A01 task.
const mockHash = async (password: string) => `hashed_${password}`;
const mockCompare = async (password: string, hash: string) => hash === `hashed_${password}`;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPet, setPetState] = useState<Pet | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecovery | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const epoch = useRef(new SessionEpoch());
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  useEffect(() => {
    clearRuntimeSession(localStorage);
    return () => { epoch.current.begin(); };
  }, []);

  const beginSession = () => {
    const version = epoch.current.begin();
    clearRuntimeSession(localStorage);
    userRef.current = null;
    setIsAuthenticated(false);
    setCurrentUser(null);
    setPetState(null);
    setSessionVersion(version);
    setPendingRecovery(null);
    setRecoveryError(null);
    setRecoveryBusy(false);
    window.dispatchEvent(new CustomEvent('user-logout'));
    return version;
  };

  const finishSignIn = (user: User, pet: Pet | null, version: number) => {
    epoch.current.assertCurrent(version);
    localStorage.setItem('currentUserId', user.id);
    localStorage.setItem('activeSession', JSON.stringify({ userId: user.id, token: crypto.randomUUID() }));
    userRef.current = user;
    setCurrentUser(user);
    setPetState(pet);
    setIsAuthenticated(true);
    setPendingRecovery(null);
  };

  useEffect(() => businessRepository.subscribe(snapshot => {
    const user = userRef.current;
    if (!user || user.id !== snapshot.userId) return;
    const updated = { ...user, achievements: snapshot.data.achievements };
    userRef.current = updated;
    setCurrentUser(updated);
    setPetState(snapshot.data.pet);
  }), []);

  const migrateAndSignIn = async (user: User, pet: Pet | null, version: number) => {
    const snapshot = await initializeBusiness(user, pet, () => epoch.current.isCurrent(version));
    finishSignIn({ ...user, achievements: snapshot.data.achievements }, snapshot.data.pet, version);
  };

  const login = async (identifier: string, password: string): Promise<boolean> => {
    const version = beginSession();
    const users: User[] = JSON.parse(localStorage.getItem('users') ?? '[]');
    if (!Array.isArray(users)) throw new Error('Account records could not be read. Existing data has been preserved.');
    const user = users.find(entry => entry.username === identifier || entry.email === identifier);
    if (!user || !await mockCompare(password, user.password)) return false;
    epoch.current.assertCurrent(version);
    const existing = await businessRepository.read(user.id);
    epoch.current.assertCurrent(version);
    if (existing) {
      finishSignIn({ ...user, achievements: existing.data.achievements }, existing.data.pet, version);
      return true;
    }
    let loaded: PetLoad;
    try { loaded = await petRepository.load(user.id, () => epoch.current.isCurrent(version)); }
    catch (error) {
      epoch.current.assertCurrent(version);
      throw new Error(error instanceof Error ? `Pet data could not be loaded: ${error.message}` : 'Pet data could not be read. Existing data has been preserved.');
    }
    epoch.current.assertCurrent(version);
    if (loaded.status === 'conflict') {
      setPendingRecovery({ user, version, conflict: loaded });
      throw new Error('Different pet copies need your choice before sign-in can finish.');
    }
    await migrateAndSignIn(user, loaded.pet, version);
    return true;
  };

  const selectPetCopy = async (source: PetSource) => {
    const pending = pendingRecovery;
    if (!pending || recoveryBusy) return;
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const pet = await petRepository.resolve(pending.user.id, source, pending.conflict.revision, () => epoch.current.isCurrent(pending.version));
      await migrateAndSignIn(pending.user, pet, pending.version);
    } catch (error) {
      if (epoch.current.isCurrent(pending.version)) setRecoveryError(error instanceof Error ? error.message : 'The choice could not be saved. Existing copies have been preserved.');
    } finally {
      if (epoch.current.isCurrent(pending.version)) setRecoveryBusy(false);
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    const version = beginSession();
    const users: User[] = JSON.parse(localStorage.getItem('users') ?? '[]');
    if (!Array.isArray(users)) throw new Error('Account records could not be read.');
    if (users.some(user => user.username === username || user.email === email)) return false;
    const hash = await mockHash(password);
    epoch.current.assertCurrent(version);
    const user: User = {
      id: crypto.randomUUID(), username, email, password: hash, avatar: '',
      createdAt: new Date().toISOString(), achievements: [],
    };
    localStorage.setItem('users', JSON.stringify([...users, user]));
    // Registration UI explicitly asks the user to sign in; no hidden active session.
    return true;
  };

  const logout = () => { beginSession(); };

  const createPet = useCallback(async (pet: Pet): Promise<void> => {
    const user = userRef.current;
    const version = sessionVersion;
    if (!user || pet.userId !== user.id) throw new Error('A matching account is required.');
    const snapshot = await businessRepository.transact(user.id, data => {
      if (data.pet) throw new Error('This account already has a pet.');
      return { ...data, pet: decodePet(pet, user.id) };
    }, () => epoch.current.isCurrent(version));
    epoch.current.assertCurrent(version);
    setPetState(snapshot.data.pet);
  }, [sessionVersion]);

  const updatePet = useCallback(async (change: (pet: Pet) => Pet): Promise<Pet> => {
    const user = userRef.current;
    const version = sessionVersion;
    if (!user) throw new Error('Sign in before updating a pet.');
    const snapshot = await businessRepository.transact(user.id, data => {
      if (!data.pet) throw new Error('Pet data is unavailable.');
      const pet = decodePet(change(data.pet), user.id);
      if (pet.id !== data.pet.id) throw new Error('An update cannot replace a pet identity.');
      return { ...data, pet };
    }, () => epoch.current.isCurrent(version));
    epoch.current.assertCurrent(version);
    setPetState(snapshot.data.pet);
    return snapshot.data.pet!;
  }, [sessionVersion]);

  const updateUserProfile = async (updates: Partial<User>): Promise<boolean> => {
    const user = userRef.current;
    const version = sessionVersion;
    if (!user || !epoch.current.isCurrent(version) || (updates.id && updates.id !== user.id) || updates.achievements !== undefined) return false;
    const users: User[] = JSON.parse(localStorage.getItem('users') ?? '[]');
    if (!Array.isArray(users)) return false;
    const index = users.findIndex(entry => entry.id === user.id);
    if (index < 0) return false;
    const updated = { ...users[index], ...updates, id: user.id };
    if (users.some(entry => entry.id !== user.id && (entry.username === updated.username || entry.email === updated.email))) return false;
    epoch.current.assertCurrent(version);
    users[index] = updated;
    localStorage.setItem('users', JSON.stringify(users));
    const visible = { ...updated, achievements: userRef.current?.achievements ?? [] };
    userRef.current = visible;
    setCurrentUser(visible);
    return true;
  };

  return <AuthContext.Provider value={{
    isAuthenticated, currentUser, currentPet, sessionVersion,
    login, register, logout, createPet, updatePet, updateUserProfile,
  }}>
    {children}
    {pendingRecovery && <PetRecoveryDialog
      key={pendingRecovery.version}
      candidates={pendingRecovery.conflict.candidates}
      busy={recoveryBusy}
      error={recoveryError}
      onSelect={selectPetCopy}
      onCancel={logout}
    />}
  </AuthContext.Provider>;
};
