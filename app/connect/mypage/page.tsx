"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/connect/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { 
  showSpinner, hideSpinner, showDialog, 
  deleteTicket, archiveAndDeleteDoc, clearAllAppSession,
  formatDateToYMDDot 
} from "@/lib/connect/functions";
import Link from "next/link";
import "./mypage.css"; // ← これが必要です！

// 型定義
interface Ticket {
  id: string;
  liveId: string;
  resType: string;
  reservationNo: string;
  representativeName: string;
  companions: string[];
  liveData?: any;
}

export default function MyPage() {
  const { user, loading, userData } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetching, setFetching] = useState(true);

  // 認証ガード & 初期データ取得
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/connect"); // ログインしてなければトップへ
      return;
    }
    loadMyTickets();
  }, [user, loading]);

  const loadMyTickets = async () => {
    showSpinner();
    if (!user) return;
    setFetching(true);
    try {
      const q = query(
        collection(db, "tickets"),
        where("uid", "==", user.uid),
        orderBy("updatedAt", "desc")
      );
      const snap = await getDocs(q);
      
      const ticketList: Ticket[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Ticket;
        // Live情報の詳細も取得
        const liveSnap = await getDoc(doc(db, "lives", data.liveId));
        ticketList.push({
          ...data,
          id: d.id,
          liveData: liveSnap.exists() ? liveSnap.data() : null
        });
      }
      setTickets(ticketList);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
      hideSpinner();
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (!(await showDialog("ログアウトしますか？"))) return;
    showSpinner();
    await auth.signOut();
    clearAllAppSession();
    hideSpinner();
    router.push("/connect");
  };

  // 退会処理
  const handleWithdrawal = async () => {
    const confirmMsg = "【退会確認】\n退会すると予約済みのチケットもすべて無効になります。本当によろしいですか？";
    if (!(await showDialog(confirmMsg))) return;
    if (!(await showDialog("本当に退会しますか？この操作は取り消せません。"))) return;

    showSpinner();
    try {
      // チケット削除
      for (const t of tickets) {
        await deleteTicket(t.liveId, user?.uid, false);
      }
      // ユーザー削除（アーカイブ）
      await archiveAndDeleteDoc("connectUsers", user!.uid);
      await auth.signOut();
      clearAllAppSession();
      await showDialog("退会処理が完了しました。", true);
      router.push("/connect");
    } catch (e) {
      alert("エラーが発生しました");
    } finally {
      hideSpinner();
    }
  };

  // URLコピー
  const handleCopyUrl = async (resType: string, ticketId: string) => {
    const url = `${window.location.origin}/ticket-detail/${ticketId}`;
    await navigator.clipboard.writeText(url);
    const msg = resType === 'invite' 
      ? "招待用URLをコピーしました！" 
      : "チケットURLをコピーしました！";
    await showDialog(msg, true);
  };

  if (loading || fetching) return <div className="inner">Loading...</div>;

  return (
    <main>
      <section className="hero" style={{ "--hero-bg": 'url("https://tappy-heartful.github.io/streak-connect-images/background/mypage.jpg")' } as any}>
        <div className="hero-content">
          <h1 className="page-title">MY PAGE</h1>
          <p className="tagline">User Profile & Tickets</p>
        </div>
      </section>

      <section className="content-section">
        <div className="inner">
          <nav className="breadcrumb">
            <Link href="/connect">Home</Link>
            <span className="separator">&gt;</span>
            <span className="current">My Page</span>
          </nav>

          <div className="profile-card">
            <div className="profile-icon-wrapper">
              <img src={userData?.pictureUrl || "/line-unset.png"} alt="icon" />
            </div>
            <div className="profile-info">
              <p className="profile-label">ようこそ,</p>
              <h2 className="profile-name">{userData?.displayName || "Guest"} 様</h2>
              <div className="profile-actions" style={{ display: "flex", gap: "10px" }}>
                <button className="btn-logout" onClick={handleLogout}>ログアウト</button>
                <button className="btn-delete-account" onClick={handleWithdrawal}>退会</button>
              </div>
            </div>
          </div>

          <h2 className="section-title">MY TICKETS</h2>
          <div id="my-tickets-container">
            {tickets.length === 0 ? (
              <p className="no-data">予約済みのチケットはありません。</p>
            ) : (
              tickets.map((ticket) => (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  onRefresh={loadMyTickets} 
                  onCopy={handleCopyUrl}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <div className="page-actions" style={{ textAlign: "center", paddingBottom: "60px" }}>
        <Link href="/connect" className="btn-back-home">
          ← Homeに戻る
        </Link>
      </div>
    </main>
  );
}

// チケットカードをコンポーネントとして分割
function TicketCard({ ticket, onRefresh, onCopy }: { ticket: Ticket, onRefresh: () => void, onCopy: any }) {
  const live = ticket.liveData;
  if (!live) return null;
  const { user } = useAuth();

  const today = formatDateToYMDDot(new Date());
  const isPast = live.date < today;
  const canModify = !isPast && live.isAcceptReserve;

  return (
    <div className="ticket-card detail-mode">
      <div className="card-status-area">
        <div className="res-no-mini">NO. {ticket.reservationNo || "----"}</div>
      </div>
      
      <div className="ticket-info">
        <span className="res-type-label">{ticket.resType === 'invite' ? '招待予約' : '一般予約'}</span>
        <div className="t-date">{live.date}</div>
        <Link href={`/connect/live-detail/${ticket.liveId}`} className="t-title-link">
          <h3 className="t-title">{live.title}</h3>
        </Link>
        
        <div className="t-details">
          <p><i className="fa-solid fa-location-dot"></i> 会場: {live.venue}</p>
          <p><i className="fa-solid fa-user"></i> 代表者: {ticket.representativeName} 様</p>
          <p><i className="fa-solid fa-users"></i> 同伴者: {ticket.companions?.join(" 様、") || "なし"}{ticket.companions?.length > 0 && " 様"}</p>
        </div>
        
        <div className="ticket-actions">
          <button className="btn-view" onClick={() => onCopy(ticket.resType, ticket.id)}>URLコピー</button>
          <Link href={`/connect/ticket-detail/${ticket.id}`} className="btn-ticket">チケット表示</Link>
        </div>

        {canModify ? (
          <div className="ticket-actions">
            <Link href={`/connect/ticket-reserve/${ticket.liveId}`} className="btn-edit">変更</Link>
            <button className="btn-delete" onClick={async () => {
              if (await deleteTicket(ticket.id, user?.uid)) onRefresh();
            }}>取消</button>
          </div>
        ) : (
          <div className="ticket-actions">
            <span className="status-badge">{isPast ? '終了' : '受付期間外'}</span>
          </div>
        )}
      </div>
    </div>
  );
}