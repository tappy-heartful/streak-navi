"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/connect/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { 
  showSpinner, hideSpinner, showDialog, 
  deleteTicket, formatDateToYMDDot 
} from "@/lib/connect/functions";
import Link from "next/link";
import "./live-detail.css";

export default function LiveDetailPage() {
  const { id } = useParams(); // URLから[id]を取得
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [live, setLive] = useState<any>(null);
  const [isReserved, setIsReserved] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id, user]);

  const loadData = async () => {
    setFetching(true);
    try {
      // 1. ライブデータの取得
      const liveRef = doc(db, "lives", id as string);
      const liveSnap = await getDoc(liveRef);

      if (!liveSnap.exists()) {
        await showDialog("ライブ情報が見つかりませんでした。", true);
        router.push("/connect");
        return;
      }
      setLive(liveSnap.data());

      // 2. 予約状況の確認
      if (user) {
        const ticketRef = doc(db, "tickets", `${id}_${user.uid}`);
        const ticketSnap = await getDoc(ticketRef);
        setIsReserved(ticketSnap.exists());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleCancel = async () => {
    if (await deleteTicket(id as string, user?.uid)) {
      await loadData(); // 状態を更新
    }
  };

  const handleReserveClick = async () => {
    if (!user) {
      const ok = await showDialog("予約にはログインが必要です。\nログインしますか？");
      if (ok) {
        // ヘッダーと同様のログイン処理を走らせるか、
        // 単純にトップに戻してログインを促す
        router.push("/connect");
      }
      return;
    }
    router.push(`/connect/ticket-reserve/${id}`);
  };

  if (authLoading || fetching) return <div className="inner">Loading...</div>;
  if (!live) return null;

  // 予約期間・ステータス判定
  const todayStr = formatDateToYMDDot(new Date());
  const isAccepting = live.isAcceptReserve === true;
  const isPast = live.date < todayStr;
  const isBefore = live.acceptStartDate && todayStr < live.acceptStartDate;
  const isAfter = live.acceptEndDate && todayStr > live.acceptEndDate;

  return (
    <main>
      <section className="hero" style={{ "--hero-bg": 'url("https://tappy-heartful.github.io/streak-connect-images/background/live-detail.jpg")' } as any}>
        <div className="hero-content">
          <h1 className="page-title">LIVE INFO</h1>
          <p className="tagline">Join our special performance</p>
        </div>
      </section>

      <section className="content-section">
        <div className="inner">
          <nav className="breadcrumb">
            <Link href="/connect">Home</Link>
            <span className="separator">&gt;</span>
            <span className="current">Live Detail</span>
          </nav>

          <div id="live-content-area">
            {live.flyerUrl && (
              <div className="flyer-wrapper">
                <img src={live.flyerUrl} alt="Flyer" />
              </div>
            )}

            <div className="live-info-card">
              <div className="l-date">
                {isReserved && <span className="reserved-label">予約済み</span>}
                {live.date}
              </div>
              <h2 className="l-title">{live.title}</h2>
              
              <div className="info-list">
                <div className="info-item">
                  <i className="fa-solid fa-location-dot"></i>
                  <div>
                    <div className="label">会場</div>
                    <div className="val">
                      {live.venue}<br />
                      {live.venueUrl && <a href={live.venueUrl} target="_blank" className="mini-link">公式サイト</a>}
                      {live.venueUrl && live.venueGoogleMap && " / "}
                      {live.venueGoogleMap && <a href={live.venueGoogleMap} target="_blank" className="mini-link">地図を見る</a>}
                    </div>
                  </div>
                </div>

                <div className="info-item">
                  <i className="fa-solid fa-clock"></i>
                  <div>
                    <div className="label">時間</div>
                    <div className="val">Open {live.open} / Start {live.start}</div>
                  </div>
                </div>

                <div className="info-item">
                  <i className="fa-solid fa-ticket"></i>
                  <div>
                    <div className="label">料金</div>
                    <div className="val">前売: {live.advance} / 当日: {live.door}</div>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="sub-title">注意事項</h3>
            <div className="t-details">
              <p><i className="fa-solid fa-users"></i> お一人様 {live.maxCompanions}名様まで同伴可能</p>
              <p><i className="fa-solid fa-circle-info"></i> チケット残数: あと {live.ticketStock - (live.totalReserved || 0)} 枚</p>
              {live.notes && (
                <div className="live-notes-area">{live.notes}</div>
              )}
            </div>
          </div>

          <div className="live-actions">
            {isPast ? (
              <button className="btn-action disabled" disabled>このライブは終了しました</button>
            ) : (!isAccepting || isBefore || isAfter) ? (
              <div className="action-box">
                {isReserved && (
                  <Link href={`/connect/ticket-detail/${id}_${user?.uid}`} className="btn-action btn-view-white">
                    <i className="fa-solid fa-ticket"></i> チケットを表示
                  </Link>
                )}
                <button className="btn-action disabled" disabled>
                  {isBefore ? "予約受付前" : isAfter ? "予約受付終了" : "予約受付停止中"}
                </button>
                {live.acceptStartDate && (
                  <p className="accept-period">受付期間: {live.acceptStartDate} ～ {live.acceptEndDate}</p>
                )}
              </div>
            ) : (
              <div className="action-box">
                {isReserved ? (
                  <div className="reserved-actions">
                    <Link href={`/connect/ticket-detail/${id}_${user?.uid}`} className="btn-action btn-view-white">
                      <i className="fa-solid fa-ticket"></i> チケットを表示
                    </Link>
                    <button onClick={handleReserveClick} className="btn-action btn-reserve-red">
                      <i className="fa-solid fa-pen-to-square"></i> 予約内容を変更
                    </button>
                    <button className="btn-action btn-delete-outline" onClick={handleCancel}>
                      <i className="fa-solid fa-trash-can"></i> 予約を取り消す
                    </button>
                  </div>
                ) : (
                  <div className="reserved-actions">
                    <button onClick={handleReserveClick} className="btn-action btn-reserve-red">
                      <i className="fa-solid fa-paper-plane"></i> このライブを予約する
                    </button>
                    <p className="accept-period">受付期間: {live.acceptStartDate} ～ {live.acceptEndDate}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="page-actions">
        <Link href="/connect" className="btn-back-home"> ← Homeに戻る </Link>
      </div>
    </main>
  );
}