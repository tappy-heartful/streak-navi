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
      setLoading(true); // 状態変化が始まったら一旦loadingをtrueにするのが安全

      if (firebaseUser) {
        // --- 修正ポイント1: Authが成功していれば即座にuserをセットする ---
        setUser(firebaseUser);
        setSession("uid", firebaseUser.uid);

        // Firestoreからユーザー詳細を取得
        const userRef = doc(db, "connectUsers", firebaseUser.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          // 既存のセッション管理との互換性
          Object.entries(data).forEach(([k, v]) => setSession(k, v));
        } else {
          // --- 修正ポイント2: Firestoreにデータがなくても、userをnullにしない ---
          // まだ登録プロセス（Agreement）が終わっていないだけの状態なので、
          // user情報は保持したままにする。userDataだけnullになる。
          setUserData(null);
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