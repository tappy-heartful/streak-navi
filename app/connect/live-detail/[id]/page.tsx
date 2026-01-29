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

  // データ取得とタブタイトルの更新
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
      if (ok) router.push("/connect");
      return;
    }
    router.push(`/connect/ticket-reserve/${id}`);
  };

  if (authLoading || fetching) return <div className="loading-text">Loading...</div>;
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
            {/* フライヤー画像エリア */}
            {live.flyerUrl && (
              <div className="flyer-wrapper">
                <img src={live.flyerUrl} alt="Flyer" />
              </div>
            )}

            {/* ライブ基本情報カード */}
            <div className="live-info-card">
              <div className="l-date">
                {live.date}
                {isReserved && <span className="reserved-label" style={{marginLeft: "10px", fontSize: "0.8rem", background: "#e7211a", color: "#fff", padding: "2px 8px", borderRadius: "4px"}}>予約済み</span>}
              </div>
              <h2 className="l-title">{live.title}</h2>
              
              <div className="info-list">
                {/* 会場情報 */}
                <div className="info-item">
                  <i className="fa-solid fa-location-dot"></i>
                  <div>
                    <div className="label">会場</div>
                    <div className="val">
                      {live.venue}<br />
                      {live.venueUrl && <a href={live.venueUrl} target="_blank" rel="noopener noreferrer">公式サイト</a>}
                      {live.venueUrl && live.venueGoogleMap && " / "}
                      {live.venueGoogleMap && <a href={live.venueGoogleMap} target="_blank" rel="noopener noreferrer">地図を見る</a>}
                    </div>
                  </div>
                </div>

                {/* 時間情報 */}
                <div className="info-item">
                  <i className="fa-solid fa-clock"></i>
                  <div>
                    <div className="label">時間</div>
                    <div className="val">Open {live.open} / Start {live.start}</div>
                  </div>
                </div>

                {/* 料金情報 */}
                <div className="info-item">
                  <i className="fa-solid fa-ticket"></i>
                  <div>
                    <div className="label">料金</div>
                    <div className="val">前売: {live.advance}</div>
                    <div className="val">当日: {live.door}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 注意事項・備考エリア */}
            <h3 className="sub-title">注意事項 / NOTES</h3>
            <div className="t-details">
              <div className="info-item" style={{marginBottom: "10px"}}>
                <i className="fa-solid fa-users"></i>
                <div className="val">お一人様 {live.maxCompanions}名様まで同伴可能</div>
              </div>
              <div className="info-item" style={{marginBottom: "20px"}}>
                <i className="fa-solid fa-circle-info"></i>
                <div className="val">チケット残数: あと {Math.max(0, live.ticketStock - (live.totalReserved || 0))} 枚</div>
              </div>
              
              {live.notes && (
                <div className="live-notes-area">
                  <p className="live-notes-text">{live.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* アクションボタンエリア */}
          <div className="live-actions" style={{ marginTop: "40px" }}>
            {isPast ? (
              <button className="btn-action disabled" style={{width: "100%", padding: "15px", borderRadius: "50px"}} disabled>このライブは終了しました</button>
            ) : (!isAccepting || isBefore || isAfter) ? (
              <div className="action-box" style={{ textAlign: "center" }}>
                {isReserved && (
                  <Link href={`/connect/ticket-detail/${id}_${user?.uid}`} className="btn-action btn-view-white" style={{display: "block", marginBottom: "15px"}}>
                    <i className="fa-solid fa-ticket"></i> チケットを表示
                  </Link>
                )}
                <button className="btn-action disabled" style={{width: "100%", padding: "15px", borderRadius: "50px"}} disabled>
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
                      <i className="fa-solid fa-trash-can"></i> この予約を取り消す
                    </button>
                  </div>
                ) : (
                  <div className="unreserved-actions" style={{ textAlign: "center" }}>
                    <button onClick={handleReserveClick} className="btn-reserve" style={{width: "100%"}}>
                      <i className="fa-solid fa-paper-plane"></i> このライブを予約する / RESERVE
                    </button>
                    {live.acceptStartDate && (
                      <p className="accept-period">受付終了: {live.acceptEndDate}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="page-actions" style={{ textAlign: "center", padding: "60px 0" }}>
        <Link href="/connect" className="btn-back-home"> ← Homeに戻る </Link>
      </div>
    </main>
  );
}