"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { showSpinner, hideSpinner, globalAuthServerRender } from "@/lib/connect/functions";

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      handleLogin(code, state);
    }
  }, [searchParams]);

  async function handleLogin(code: string, state: string) {
    try {
      showSpinner();
      const redirectUri = window.location.origin + window.location.pathname;

      // 1. 自前サーバーでLINE認証
      const res = await fetch(`${globalAuthServerRender}/line-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state, redirectUri }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // 2. Firebaseログイン
      const { user } = await signInWithCustomToken(auth, data.customToken);

      // 3. Firestoreデータ更新
      const userRef = doc(db, "connectUsers", user.uid);
      const snap = await getDoc(userRef);
      
      const userData = {
        displayName: data.profile.displayName,
        pictureUrl: data.profile.pictureUrl,
        lastLoginAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
      };
      
      await setDoc(userRef, userData, { merge: true });
      const updatedSnap = await getDoc(userRef);
      const finalData = updatedSnap.data();

      // 4. 規約同意チェック & リダイレクト
      if (!finalData?.agreedAt) {
        router.push("/agreement"); // 同意ページへ
      } else {
        router.push(data.redirectAfterLogin || "/"); // ホームまたは元のページへ
      }
    } catch (e: any) {
      alert("ログインに失敗しました: " + e.message);
      router.push("/");
    } finally {
      hideSpinner();
    }
  }

  return <div className="loading-screen">Authenticating...</div>;
}