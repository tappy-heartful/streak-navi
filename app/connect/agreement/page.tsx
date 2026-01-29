"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/connect/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { showSpinner, hideSpinner, getSession, removeSession } from "@/lib/connect/functions";
import Link from "next/link";
import "./agreement.css";

export default function AgreementPage() {
  const [agreed, setAgreed] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    document.title = "利用規約 | SSJO Connect";
  }, []);

  // 認証ガード
  useEffect(() => {
    if (!loading && !user) {
      router.push("/connect");
    }
  }, [user, loading, router]);

  const handleAgree = async () => {
    if (!user) return;
    showSpinner();
    try {
      await updateDoc(doc(db, "connectUsers", user.uid), {
        agreedAt: serverTimestamp(),
        status: "active" // 規約同意をもってアクティブユーザーとする
      });

      // セッションに保存されたリダイレクト先があればそこへ、なければHomeへ
      const target = getSession("pendingRedirect") || "/connect";
      removeSession("pendingRedirect");
      
      router.push(target);
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。時間を置いて再度お試しください。");
    } finally {
      hideSpinner();
    }
  };

  if (loading) return <div className="loading-text">Loading...</div>;

  return (
    <main className="agreement-page">
      <section className="hero-mini">
        <div className="hero-content">
          <h1 className="page-title">TERMS OF SERVICE</h1>
          <p className="tagline">利用規約への同意</p>
        </div>
      </section>

      <div className="inner">
        <div className="agreement-wrapper">
          <div className="agreement-header">
            <h3>SSJO Connect 利用規約</h3>
            <p>本サービスをご利用いただくために、以下の内容をご確認の上、同意をお願いいたします。</p>
          </div>

          <div className="agreement-box">
            <div className="agreement-content">
              <h4>第1条（目的）</h4>
              <p>本規約は、SSJO（以下「当団体」）が提供するチケット予約管理システム「Streak Connect」（以下「本サービス」）の利用条件を定めるものです。</p>

              <h4>第2条（ユーザー登録）</h4>
              <p>ユーザーは、LINE連携を通じて登録を行うものとし、正確な情報を提供する責任を負います。</p>

              <h4>第3条（予約のキャンセル）</h4>
              <p>ライブの予約キャンセルは、本サービス上のマイページより行うことができます。ただし、公演直前や当日のキャンセルについては、別途案内する各公演のルールに従うものとします。</p>

              <h4>第4条（禁止事項）</h4>
              <p>・他人になりすまして予約を行う行為<br />
                 ・チケットを営利目的で転売する行為<br />
                 ・システムの運営を妨害する行為</p>

              <h4>第5条（免責事項）</h4>
              <p>当団体は、本サービスの中断や遅延により発生した損害について、一切の責任を負わないものとします。</p>
              
              <p className="agreement-footer">2026年1月29日 制定</p>
            </div>
          </div>

          <div className="agreement-actions">
            <label className="checkbox-container">
              <input 
                type="checkbox" 
                checked={agreed} 
                onChange={(e) => setAgreed(e.target.checked)} 
              />
              <span className="checkmark"></span>
              規約の内容を理解し、同意します
            </label>

            <button 
              disabled={!agreed} 
              onClick={handleAgree} 
              className={`btn-agree ${agreed ? 'active' : ''}`}
            >
              登録を完了してはじめる
            </button>
            
            <div className="cancel-link">
              <Link href="/connect">同意せずに戻る</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}