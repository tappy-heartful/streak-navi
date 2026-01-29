"use client";

import { useState } from "react";
import Link from "next/link";
import "./about.css";

type TabId = "about" | "reserve" | "disclaimer" | "privacy";

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<TabId>("about");

  return (
    <main className="about-page">
      <h1 className="page-title">サイト情報 | Streak Connect</h1>

      <div className="tabs">
        <div
          className={`tab ${activeTab === "about" ? "active" : ""}`}
          onClick={() => setActiveTab("about")}
        >
          当サイトについて
        </div>
        <div
          className={`tab ${activeTab === "reserve" ? "active" : ""}`}
          onClick={() => setActiveTab("reserve")}
        >
          予約について
        </div>
        <div
          className={`tab ${activeTab === "disclaimer" ? "active" : ""}`}
          onClick={() => setActiveTab("disclaimer")}
        >
          免責事項
        </div>
        <div
          className={`tab ${activeTab === "privacy" ? "active" : ""}`}
          onClick={() => setActiveTab("privacy")}
        >
          プライバシー
        </div>
      </div>

      <div className="tab-container">
        {/* 当サイトについて */}
        <section className={`tab-content ${activeTab === "about" ? "active" : ""}`}>
          <h2>このサイトについて</h2>
          <p>
            <strong>Streak Connect</strong> は、Swing Streak Jazz
            Orchestra（SSJO）の活動をより円滑に、より楽しくするためのメンバー・ファン向けポータルサイトです。
          </p>
          <p>
            従来、複数のページに分散していたライブ情報、楽団紹介、グッズ案内をHome画面に集約し、スクロールだけで直感的に全ての情報を確認できるよう設計されています。
          </p>
          <p>
            また、LINEログインと連携することで、個別のチケット予約管理やマイページの利用を可能にしています。
          </p>
        </section>

        {/* 予約について */}
        <section className={`tab-content ${activeTab === "reserve" ? "active" : ""}`}>
          <h2>チケット予約について</h2>
          <p>
            本サイトでのチケット予約は、LINEアカウントを利用した事前予約制です。
          </p>
          <ul>
            <li>
              <strong>予約の確定:</strong>
              フォームから送信後、マイページにチケットが表示されることで予約完了となります。
            </li>
            <li>
              <strong>同伴者:</strong>
              各ライブの設定に基づき、指定の人数まで同時に予約が可能です。
            </li>
            <li>
              <strong>変更・取消:</strong>
              ライブ当日の指定時間まで、マイページより自由に変更・取り消しが行えます。
            </li>
          </ul>
          <p className="note">※満席となった場合、予告なく予約受付を終了することがあります。</p>
        </section>

        {/* 免責事項 */}
        <section className={`tab-content ${activeTab === "disclaimer" ? "active" : ""}`}>
          <h2>免責事項</h2>
          <p>
            当サイトに掲載される情報は、最新の注意を払って管理しておりますが、ライブの日時、会場、料金等の詳細は変更される場合があります。最新の情報はHome画面、または公式Instagramをご確認ください。
          </p>
          <p>
            システム保守や障害、その他の理由により、予告なくサービスの一部を中断・変更することがあります。これにより生じた不利益について、当楽団は一切の責任を負いかねますのでご了承ください。
          </p>
        </section>

        {/* プライバシーポリシー */}
        <section className={`tab-content ${activeTab === "privacy" ? "active" : ""}`}>
          <h2>プライバシーポリシー</h2>
          <p>
            <strong>1. 情報の取得:</strong>
            LINEログインを通じて、ユーザーの識別子（UID）、表示名、プロフィール画像を取得します。
          </p>
          <p>
            <strong>2. 利用目的:</strong>
            取得した情報は、チケット予約の本人確認、マイページへの反映、およびライブ運営（受付名簿作成）のみに利用します。
          </p>
          <p>
            <strong>3. データの管理:</strong> ユーザーデータは Firebase Firestore
            上で管理され、適切なセキュリティ対策を講じています。
          </p>
          <p>
            <strong>4. 第三者提供:</strong>
            法令に基づく場合を除き、取得した個人情報を第三者に提供することはありません。
          </p>
        </section>
      </div>

      <div className="page-footer">
        <Link href="/" className="back-link">
          ← ホームに戻る
        </Link>
      </div>
    </main>
  );
}