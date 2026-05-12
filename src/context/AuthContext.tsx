import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { logEvent, AuditEventType } from '@/src/lib/audit';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  updateProfile: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  updateProfile: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.settings?.theme) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(profile.settings.theme);
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [profile?.settings?.theme]);

  const updateProfile = async (data: any) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, data, { merge: true });
      setProfile((prev: any) => ({ ...prev, ...data }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        logEvent(AuditEventType.USER_LOGIN, "Session started", firebaseUser.uid, firebaseUser.email || undefined);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          const defaultSettings = { 
            aiByDefault: false, 
            theme: 'dark', 
            showSidebarCloseBtn: true,
            sidebarEnabled: true
          };
          const defaultStats = {
            totalSolved: 0,
            totalCorrect: 0,
            totalQuestions: 2000
          };
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            const isBoss = firebaseUser.email?.toLowerCase() === 'vip.medicus@gmail.com';
            
            if (isBoss && data.role !== 'SUPERADMIN') {
              const updatedProfile = { 
                ...data, 
                uid: firebaseUser.uid,
                role: 'SUPERADMIN', 
                isApproved: true,
                settings: data.settings || defaultSettings,
                stats: data.stats || defaultStats,
                course: data.course || '1',
                specialty: data.specialty || 'med',
                sessionType: data.sessionType || 'summer',
                isConfigured: data.isConfigured || false
              };
              await setDoc(userDocRef, updatedProfile, { merge: true });
              setProfile(updatedProfile);
            } else {
              setProfile({ 
                ...data, 
                uid: firebaseUser.uid,
                settings: data.settings || defaultSettings,
                stats: data.stats || defaultStats,
                course: data.course || '1',
                specialty: data.specialty || 'med',
                sessionType: data.sessionType || 'summer',
                isConfigured: data.isConfigured || false
              });
            }
          } else {
            const isBoss = firebaseUser.email?.toLowerCase() === 'vip.medicus@gmail.com';
            
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: isBoss ? 'SUPERADMIN' : 'USER',
              isApproved: isBoss ? true : false,
              createdAt: serverTimestamp(),
              settings: defaultSettings,
              stats: defaultStats,
              streak: 0,
              course: '1',
              specialty: 'med',
              sessionType: 'summer',
              isConfigured: false
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, updateProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
