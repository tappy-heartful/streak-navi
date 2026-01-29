"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { showSpinner, hideSpinner, getSession, removeSession } from "@/lib/functions";

export default function AgreementPage() {
  const [agreed, setAgreed] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleAgree = async () => {
    if (!user) return;
    showSpinner();
    try {
      await updateDoc(doc(db, "connectUsers", user.uid), {
        agreedAt: serverTimestamp()
      });
      const target = getSession("pendingRedirect") || "/";
      removeSession("pendingRedirect");
      router.push(target);
    } catch (e) {
      alert("エラーが発生しました");
    } finally {
      hideSpinner();
    }
  };

  return (
    <main className="agreement-container">
      <h2>利用規約への同意</h2>
      <div className="agreement-box">
        {/* 規約テキスト */}
        <p>ここに規約を書く...</p>
      </div>
      <label>
        <input type="checkbox" onChange={(e) => setAgreed(e.target.checked)} />
        同意する
      </label>
      <button disabled={!agreed} onClick={handleAgree} className="btn-agree">
        登録を完了する
      </button>
    </main>
  );
}