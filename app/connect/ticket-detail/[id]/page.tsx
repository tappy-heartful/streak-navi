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
import { QRCodeSVG } from "qrcode.react"; // QRコードライブラリ
import "./ticket-detail.css";

export default function TicketDetailPage() {
  const { id } = useParams(); // URLパラメータ [id]
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [ticket, setTicket] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setFetching(true);
    try {
      // 1. チケットデータの取得
      const ticketRef = doc(db, "tickets", id as string);
      const ticketSnap = await getDoc(ticketRef);

      if (!ticketSnap.exists()) {
        await showDialog("チケット情報が見つかりませんでした。", true);
        router.push("/");
        return;
      }
      const ticketData = ticketSnap.data();
      setTicket(ticketData);

      // 2. ライブデータの取得
      const liveRef = doc(db, "lives", ticketData.liveId);
      const liveSnap = await getDoc(liveRef);
      if (liveSnap.exists()) {
        setLive(liveSnap.data());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    const msg = ticket?.resType === 'invite'
      ? "招待用URLをコピーしました！\nご招待するお客様に共有してください。"
      : "チケットURLをコピーしました！\n同伴者様に共有してください。";
    await showDialog(msg, true);
  };

  const handleDelete = async () => {
    if (await deleteTicket(ticket.liveId)) {
      router.push("/mypage");
    }
  };

  if (authLoading || fetching) return <div className="inner">Loading...</div>;
  if (!ticket || !live) return null;

  // 権限・ステータス判定
  const isOwner = user?.uid === ticket.uid;
  const todayStr = formatDateToYMDDot(new Date());
  const isPast = live.date < todayStr;
  const canModify = !isPast && live.isAcceptReserve;

  return (
    <main>
      <section className="hero" style={{ "--hero-bg": 'url("https://tappy-heartful.github.io/streak-connect-images/background/ticket-detail.jpg")' } as any}>
        <div className="hero-content">
          <h1 className="page-title">TICKET</h1>
          <p className="tagline">Confirmation for Guests</p>
        </div>
      </section>

      <section className="content-section">
        <div className="inner">
          <nav className="breadcrumb">
            <Link href="/">Home</Link>
            <span className="separator">&gt;</span>
            <Link href={`/live-detail/${ticket.liveId}`}>Live Detail</Link>
            <span className="separator">&gt;</span>
            <span className="current">Ticket</span>
          </nav>

          <p className="ticket-guide-text">
            {ticket.resType === 'invite' && isOwner
              ? '招待するお客様にこのページを共有してください！'
              : '当日はこの画面を会場受付にてご提示ください！'}
          </p>

          <div className="ticket-card detail-mode">
            <div className="res-no-wrapper">
              <span className="res-no-label">RESERVATION NO.</span>
              <div className="res-no-display">
                <span className="res-no-value">{ticket.reservationNo || "----"}</span>
              </div>
              <button className="btn-copy-no" onClick={handleCopyUrl}>
                <i className="fa-solid fa-link"></i> <span>COPY</span>
              </button>
            </div>

            <div className="qr-wrapper">
              {/* QRコード生成部分 */}
              <div className="qrcode-container">
                <QRCodeSVG 
                  value={id as string} 
                  size={160} 
                  bgColor={"#1a1a1a"} 
                  fgColor={"#ffffff"} 
                  level={"H"}
                />
              </div>
              <p className="qr-note">FOR ENTRANCE CHECK-IN</p>
            </div>

            <div className="ticket-info">
              <div className="t-date">{live.date}</div>
              <Link href={`/live-detail/${ticket.liveId}`} className="t-title-link">
                <h3 className="t-title">{live.title}</h3>
              </Link>
              <div className="t-details">
                <p><i className="fa-solid fa-location-dot"></i> 会場: {live.venue}</p>
                <p><i className="fa-solid fa-clock"></i> Open {live.open} / Start {live.start}</p>
                <p><i className="fa-solid fa-ticket"></i> 前売料金: {live.advance}</p>
              </div>
            </div>
          </div>

          <div className="share-info-wrapper">
            <p className="res-type-label-small">
              {ticket.resType === 'invite' ? 'INVITATION (招待枠)' : 'GENERAL RESERVATION (一般予約)'}
            </p>
            <h3 className="sub-title">ご予約情報</h3>
            <div className="t-details">
              <p><i className="fa-solid fa-user-check"></i> {ticket.resType === 'invite' ? '予約担当' : '代表者'}: {ticket.representativeName} 様</p>
              <p><i className="fa-solid fa-users"></i> 合計人数: {ticket.totalCount || ticket.companions?.length + 1 || 1} 名</p>
            </div>

            <h3 className="sub-title">{ticket.resType === 'invite' ? 'ご招待者様' : 'ご同伴者様'}</h3>
            <ul className="guest-list">
              {ticket.companions && ticket.companions.length > 0 ? (
                ticket.companions.map((name: string, index: number) => (
                  <li key={index} className="guest-item">
                    <i className="fa-solid fa-user-tag"></i> {name} 様
                  </li>
                ))
              ) : (
                <li className="guest-item empty">同伴者の登録はありません</li>
              )}
            </ul>
          </div>

          {live.flyerUrl && (
            <div className="flyer-wrapper">
              <img src={live.flyerUrl} alt="Flyer" />
            </div>
          )}

          {isOwner && (
            <div className="live-actions">
              {canModify ? (
                <div className="reserved-actions">
                  <Link href={`/ticket-reserve/${ticket.liveId}`} className="btn-action btn-reserve-red">
                    <i className="fa-solid fa-pen-to-square"></i> 予約を変更
                  </Link>
                  <button className="btn-action btn-delete-outline" onClick={handleDelete}>
                    <i className="fa-solid fa-trash-can"></i> 予約を取り消す
                  </button>
                  <button className="btn-action btn-copy-outline" onClick={handleCopyUrl}>
                    <i className="fa-solid fa-link"></i> チケットURLをコピー
                  </button>
                </div>
              ) : (
                <div className="reserved-actions">
                  <span className="status-badge">
                    {isPast ? "ライブは終了しました" : "予約受付期間外"}
                  </span>
                  <button className="btn-action btn-copy-outline" onClick={handleCopyUrl}>
                    <i className="fa-solid fa-link"></i> チケットURLをコピー
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="page-actions">
        <Link href={`/live-detail/${ticket.liveId}`} className="btn-back-home">
          ← Live情報に戻る
        </Link>
      </div>
    </main>
  );
}