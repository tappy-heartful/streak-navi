"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { setSession, clearAllAppSession } from "@/lib/connect/functions";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userData: any | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, userData: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firestoreからユーザー詳細を取得
        const userRef = doc(db, "connectUsers", firebaseUser.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          setUser(firebaseUser);
          // 既存のセッション管理との互換性
          setSession("uid", firebaseUser.uid);
          Object.entries(data).forEach(([k, v]) => setSession(k, v));
        } else {
          // アカウントがない場合
          setUser(null);
        }
      } else {
        setUser(null);
        setUserData(null);
        clearAllAppSession();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);