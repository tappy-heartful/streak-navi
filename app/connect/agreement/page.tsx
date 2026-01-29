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
        status: "active"
      });
      const target = getSession("pendingRedirect") || "/connect";
      removeSession("pendingRedirect");
      router.push(target);
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。");
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
          <p className="tagline">利用規約および個人情報の取り扱い</p>
        </div>
      </section>

      <div className="inner">
        <div className="agreement-wrapper">
          <div className="agreement-header">
            <h3>SSJO Connect 利用規約</h3>
            <p>本サービスをご利用いただくために、以下の内容をご確認ください。</p>
          </div>

          <div className="agreement-box">
            <div className="agreement-content">
              <h4>第1条（目的）</h4>
              <p>本規約は、SSJO（以下「当団体」）が提供するシステム「Streak Connect」（以下「本サービス」）の利用条件を定めるものです。</p>

              <h4>第2条（LINE連携による情報取得）</h4>
              <p>本サービスはLINE株式会社の提供するLINEログインを利用しています。ユーザーが同意した場合に限り、以下の情報を取得し、本人確認および予約管理の目的で使用します。</p>
              <ul>
                <li>表示名（ニックネーム）</li>
                <li>プロフィール画像URL</li>
                <li>ユーザー識別子（内部管理用のID）</li>
              </ul>

              <h4>第3条（データの保管とセキュリティ）</h4>
              <p>取得したデータおよび予約情報は、Google Cloud Platform（Firebase）の暗号化されたデータベースに安全に保管されます。</p>
              <ul>
                <li><strong>データの暗号化:</strong> 全てのデータは、Googleの高度なセキュリティ基準に従い、保管時および通信時に暗号化されます。</li>
                <li><strong>ハッシュ化の利用:</strong> 認証に関わる重要な識別子等は、ハッシュ化技術を用いて保護され、当団体の管理者であっても元の情報を直接閲覧できない形で管理されます。</li>
              </ul>

              <h4>第4条（予約の管理）</h4>
              <p>ユーザーは本サービスを通じてチケットの予約・変更を行うことができます。正確な情報を提供いただけない場合、当日ご入場いただけない場合がございます。</p>

              <h4>第5条（禁止事項）</h4>
              <p>・虚偽の情報を用いた予約行為<br />
                 ・チケットの営利目的での転売<br />
                 ・当団体の運営を妨げる行為</p>

              <h4>第6条（免責事項）</h4>
              <p>当団体は、本サービスの利用により発生した損害について、一切の責任を負わないものとします。</p>
              
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
              規約および個人情報の取り扱いに同意します
            </label>

            <button 
              disabled={!agreed} 
              onClick={handleAgree} 
              className={`btn-agree ${agreed ? 'active' : ''}`}
            >
              同意して登録を完了する
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