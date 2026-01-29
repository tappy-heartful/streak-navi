"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/connect/AuthContext";
import { db } from "@/lib/firebase";
import { 
  doc, getDoc, runTransaction, serverTimestamp 
} from "firebase/firestore";
import { 
  showSpinner, hideSpinner, showDialog, 
  formatDateToYMDDot 
} from "@/lib/connect/functions";
import Link from "next/link";
import "./ticket-reserve.css";

export default function TicketReservePage() {
  const { id } = useParams(); // liveId
  const { user, loading: authLoading, userData } = useAuth();
  const router = useRouter();

  const [live, setLive] = useState<any>(null);
  const [resType, setResType] = useState<"invite" | "general">("general");
  const [representativeName, setRepresentativeName] = useState("");
  const [companions, setCompanions] = useState<string[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [existingTicket, setExistingTicket] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/connect");
      return;
    }
    loadData();
  }, [id, user, authLoading]);

  const loadData = async () => {
    setFetching(true);
    try {
      // 1. ライブデータの取得
      const liveRef = doc(db, "lives", id as string);
      const liveSnap = await getDoc(liveRef);
      if (!liveSnap.exists()) {
        await showDialog("ライブ情報が見つかりません。", true);
        router.push("/connect");
        return;
      }
      const liveData = liveSnap.data();
      setLive(liveData);

      // 同伴者枠の初期化
      const maxComp = liveData.maxCompanions || 0;
      setCompanions(Array(maxComp).fill(""));

      // 2. メンバー（出演者）チェック
      const userRef = doc(db, "users", user!.uid); // streak-navi側の管理
      const userSnap = await getDoc(userRef);
      const memberStatus = userSnap.exists();
      setIsMember(memberStatus);
      if (memberStatus) setResType("invite"); // メンバーならデフォルトを招待に

      // 3. 既存予約の取得（あれば編集モード）
      const ticketId = `${id}_${user!.uid}`;
      const ticketRef = doc(db, "tickets", ticketId);
      const ticketSnap = await getDoc(ticketRef);

      if (ticketSnap.exists()) {
        const tData = ticketSnap.data();
        setExistingTicket(tData);
        setResType(tData.resType || (memberStatus ? "invite" : "general"));
        setRepresentativeName(tData.representativeName || "");
        
        // 既存の同伴者名をセット
        const newCompanions = Array(maxComp).fill("");
        (tData.companions || []).forEach((name: string, i: number) => {
          if (i < maxComp) newCompanions[i] = name;
        });
        setCompanions(newCompanions);
      } else {
        // 新規予約時のデフォルト名
        setRepresentativeName(userData?.displayName || "");
      }

    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalCompanions = companions.filter(name => name.trim() !== "");
    const totalCount = resType === "invite" ? finalCompanions.length : finalCompanions.length + 1;

    if (totalCount === 0) {
      await showDialog("予約人数が0名です。お名前を入力してください。", true);
      return;
    }

    if (!(await showDialog("この内容で予約を確定しますか？"))) return;

    showSpinner();
    const ticketId = `${id}_${user!.uid}`;

    try {
      await runTransaction(db, async (transaction) => {
        const liveRef = doc(db, "lives", id as string);
        const resRef = doc(db, "tickets", ticketId);

        const lSnap = await transaction.get(liveRef);
        if (!lSnap.exists()) throw new Error("ライブ情報が存在しません。");
        const lData = lSnap.data();

        // 在庫チェック
        const oldResCount = existingTicket ? existingTicket.totalCount || 0 : 0;
        const diff = totalCount - oldResCount;
        if ((lData.totalReserved || 0) + diff > (lData.ticketStock || 0)) {
          throw new Error("完売または残席不足です。");
        }

        const reservationNo = existingTicket?.reservationNo || 
                             Math.floor(1000 + Math.random() * 9000).toString();

        const ticketData: any = {
          liveId: id,
          uid: user!.uid,
          resType: resType,
          representativeName: resType === "invite" ? (userData?.displayName || "") : representativeName,
          reservationNo: reservationNo,
          companions: finalCompanions,
          companionCount: finalCompanions.length,
          totalCount: totalCount,
          isLineNotified: false,
          updatedAt: serverTimestamp(),
        };

        if (!existingTicket) {
          ticketData.createdAt = serverTimestamp();
          transaction.set(resRef, ticketData);
        } else {
          transaction.update(resRef, ticketData);
        }

        transaction.update(liveRef, { totalReserved: (lData.totalReserved || 0) + diff });
      });

      hideSpinner();
      await showDialog("予約を確定しました！", true);
      router.push(`/connect/ticket-detail/${ticketId}`);
    } catch (e: any) {
      hideSpinner();
      alert(e.message || "エラーが発生しました");
    }
  };

  if (authLoading || fetching) return <div className="inner">Loading...</div>;

  return (
    <main>
      <section className="hero" style={{ "--hero-bg": 'url("https://tappy-heartful.github.io/streak-connect-images/background/ticket-reserve.jpg")' } as any}>
        <div className="hero-content">
          <h1 className="page-title">RESERVE</h1>
          <p className="tagline">Ticket Reservation</p>
        </div>
      </section>

      <section className="content-section">
        <div className="inner">
          <nav className="breadcrumb">
            <Link href="/connect">Home</Link>
            <span className="separator">&gt;</span>
            <Link href={`/connect/live-detail/${id}`}>Live Detail</Link>
            <span className="separator">&gt;</span>
            <span className="current">Reserve</span>
          </nav>

          <div className="ticket-card detail-mode">
            <div className="ticket-info">
              <div className="t-date">{live.date}</div>
              <h3 className="t-title">{live.title}</h3>
              <div className="t-details">
                <p><i className="fa-solid fa-location-dot"></i> {live.venue}</p>
                <p><i className="fa-solid fa-clock"></i> Open {live.open} / Start {live.start}</p>
              </div>
            </div>
          </div>

          <div className="form-wrapper">
            <h2 className="section-title">チケット予約</h2>

            {isMember && (
              <div className="form-group">
                <label>予約種別 <span className="required">必須</span></label>
                <div className="radio-group">
                  <label className="radio-item">
                    <input type="radio" value="invite" checked={resType === "invite"} onChange={() => setResType("invite")} />
                    <span>招待予約</span>
                    <small className="radio-description">ライブに出演し、家族や知人の方をご招待します</small>
                  </label>
                  <label className="radio-item">
                    <input type="radio" value="general" checked={resType === "general"} onChange={() => setResType("general")} />
                    <span>一般予約</span>
                    <small className="radio-description">お客さんとしてライブを見にいきます</small>
                  </label>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {resType === "general" && (
                <div className="form-group">
                  <label>代表者氏名 <span className="required">必須</span></label>
                  <div className="input-row">
                    <input 
                      type="text" 
                      value={representativeName} 
                      onChange={(e) => setRepresentativeName(e.target.value)} 
                      required 
                      placeholder="例：ステレオ 太郎"
                    />
                    <span className="honorific">様</span>
                  </div>
                </div>
              )}

              {resType === "invite" && (
                <div className="form-group">
                  <label>予約担当（出演メンバー）</label>
                  <input type="text" value={userData?.displayName || ""} readOnly className="read-only-input" />
                </div>
              )}

              <h3 className="sub-title">
                {resType === "invite" ? "招待するお客様のお名前" : "同伴者様"}
              </h3>
              <p className="form-note">※ニックネームや間柄でも構いません</p>

              {companions.map((name, index) => (
                <div className="form-group" key={index}>
                  <label>ゲスト {index + 1}</label>
                  <div className="input-row">
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => {
                        const newComps = [...companions];
                        newComps[index] = e.target.value;
                        setCompanions(newComps);
                      }} 
                      placeholder="お名前を入力"
                    />
                    <span className="honorific">様</span>
                  </div>
                </div>
              ))}

              <div className="form-actions">
                <button type="submit" className="btn-reserve">
                  {existingTicket ? "予約内容を更新する / UPDATE" : "予約を確定する / CONFIRM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <div className="page-actions">
        <Link href={`/connect/live-detail/${id}`} className="btn-back-home"> ← Live情報に戻る </Link>
      </div>
    </main>
  );
}