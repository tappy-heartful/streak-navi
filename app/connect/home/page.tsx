"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
import { buildInstagramHtml } from "@/lib/connect/functions";
import Link from "next/link";
// CSS Modulesをインポート
import styles from "./home.module.css";

declare global {
  interface Window {
    instgrm?: any;
  }
}

export default function HomePage() {
  const [lives, setLives] = useState<any[]>([]);
  const [medias, setMedias] = useState<any[]>([]);
  const [loadingLives, setLoadingLives] = useState(true);
  const [loadingMedias, setLoadingMedias] = useState(true);

  const members = [
    { name: 'Shoei Matsushita', role: 'Guitar / Band Master', origin: 'Ehime' },
    { name: 'Miku Nozoe', role: 'Trumpet / Lead Trumpet', origin: 'Ehime' },
    { name: 'Takumi Fujimoto', role: 'Saxophne / Lead Alto Sax', origin: 'Hiroshima' },
    { name: 'Kana Asahiro', role: 'Trombone / Lead Trombone', origin: 'Nara' },
    { name: 'Hiroto Murakami', role: 'Trombone / Section Leader', origin: 'Ehime' },
    { name: 'Taisei Yuyama', role: 'Saxophne / Lead Tenor Sax', origin: 'Ehime' },
    { name: 'Shunta Yabu', role: 'Saxophne / Section Leader', origin: 'Hiroshima' },
    { name: 'Akito Kimura', role: 'Drums', origin: 'Okayama' },
    { name: 'Yojiro Nakagawa', role: 'Bass', origin: 'Hiroshima' },
  ];

  const goodsItems = ['item1.jpg', 'item2.jpg', 'item3.jpg', 'item4.jpg'];

  useEffect(() => {
    async function fetchLives() {
      try {
        const q = query(collection(db, "lives"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
        const livesData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .filter(live => live.date >= todayStr);
        setLives(livesData);
      } catch (e) {
        console.error("Lives fetch error:", e);
      } finally {
        setLoadingLives(false);
      }
    }

    async function fetchMedias() {
      try {
        const q = query(collection(db, "medias"), orderBy("date", "desc"), limit(5));
        const snapshot = await getDocs(q);
        const mediaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        setMedias(mediaData);
      } catch (e) {
        console.error("Medias fetch error:", e);
      } finally {
        setLoadingMedias(false);
      }
    }

    fetchLives();
    fetchMedias();
  }, []);

  useEffect(() => {
    if (medias.length > 0) {
      const timer = setTimeout(() => {
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [medias]);

  return (
    <main>
      {/* HERO */}
      <section className={styles.homeHero}>
        <div className={styles.homeHeroContent}>
          <h1 className={styles.bandName}>
            Swing Streak<br />
            <span className={styles.subName}>
              <span className={styles.accentJ}>J</span>azz Orchestra
            </span>
          </h1>
          <p className={styles.tagline}>BASED IN MATSUYAMA, EHIME</p>
        </div>
      </section>

      {/* UPCOMING LIVES */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">UPCOMING LIVES</h2>
          <div className={styles.ticketGrid}>
            {loadingLives ? (
              <p className="loading-text">Checking for upcoming lives...</p>
            ) : lives.length === 0 ? (
              <p className="no-data">No information available.</p>
            ) : (
              lives.map((live) => (
                <div key={live.id} className={styles.ticketCard}>
                  <div className={styles.ticketImgWrapper}>
                    <img 
                      src={live.flyerUrl || 'https://tappy-heartful.github.io/streak-connect-images/favicon.png'} 
                      className={styles.ticketImg} 
                      alt="flyer" 
                    />
                  </div>
                  <div className={styles.ticketInfo}>
                    <div className={styles.tDate}>{live.date}</div>
                    <h3 className={styles.tTitle}>{live.title}</h3>
                    <div className={styles.tDetails}>
                      <div><i className="fa-solid fa-location-dot"></i> {live.venue}</div>
                      <div><i className="fa-solid fa-clock"></i> Open {live.open} / Start {live.start}</div>
                      <div><i className="fa-solid fa-ticket"></i> 前売：{live.advance}</div>
                      <div><i className="fa-solid fa-ticket"></i> 当日：{live.door}</div>
                    </div>
                    <Link href={`/connect/live-detail/${live.id}`} className={styles.btnDetail}>
                      詳細 / VIEW INFO
                    </Link>
                    {/*TODO 検討中 <Link href={`/connect/ticket-reserve/${live.id}`} className={styles.btnReserve}>
                      予約 / RESERVE TICKET
                    </Link> */}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CONCEPT */}
      <section className="content-section" id="concept">
        <div className="inner">
          <h2 className="section-title">Concept</h2>
          <div className={styles.conceptBody}>
            <p className={styles.conceptLead}>Swingは続く...</p>
            <div className={styles.conceptText}>
              <p>Swing Streak Jazz Orchestra（SSJO）は、2022年に結成されました。</p>
              <p>現役時代に築いた関係性が、これからも絶えることなく続いていきますように。</p>
            </div>
          </div>
        </div>
      </section>

      {/* MEMBERS */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">CORE MEMBERS</h2>
          <div className={styles.memberGrid}>
            {members.map((m) => (
              <div key={m.name} className={styles.memberCard}>
                <div className={styles.memberImgWrapper}>
                  <img 
                    src={`https://tappy-heartful.github.io/streak-connect-images/members/${m.name}.jpg`} 
                    alt={m.name} 
                    className={styles.memberImg} 
                  />
                </div>
                <div className={styles.memberInfoContent}>
                  <div className={styles.memberRole}>{m.role}</div>
                  <div className={styles.memberName}>
                    {m.name.split(' ').map((p, i) => <span key={i}>{p}<br/></span>)}
                  </div>
                  <div className={styles.memberOrigin}>from {m.origin}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SNS */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">Follow Us</h2>
          <div className={styles.snsContainer}>
            <div className={styles.snsLinks}>
              <a href="https://lin.ee/suVPLxR" target="_blank" rel="noopener noreferrer" className={`${styles.snsBtn} ${styles.lineBtn}`}>
                LINE公式アカウント
              </a>
              <a href="https://www.instagram.com/swstjazz" target="_blank" rel="noopener noreferrer" className={`${styles.snsBtn} ${styles.instaBtn}`}>
                Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* STORE */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">Official Store</h2>
          <div className={styles.goodsContainer}>
            <div className={styles.horizontalScroll}>
              {goodsItems.map((item, i) => (
                <img 
                  key={i} 
                  src={`https://tappy-heartful.github.io/streak-connect-images/goods/${item}`} 
                  alt="Goods" 
                  className={styles.squareImg} 
                />
              ))}
            </div>
            <div className={styles.btnArea}>
              <a href="https://ssjo.booth.pm/" target="_blank" rel="noopener noreferrer" className={styles.btnLink}>
                <i className="fa-solid fa-cart-shopping"></i> Visit BOOTH Store
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* HISTORY */}
      <section className={`content-section ${styles.bgDarker}`}>
        <div className="inner">
          <h2 className="section-title">HISTORY</h2>
          <div className={styles.mediaGrid}>
            {loadingMedias ? (
              <p>Loading archives...</p>
            ) : (
              medias.map((m) => (
                <div key={m.id} className={styles.mediaCard}>
                  <div className={styles.mediaInfo}>
                    <span className={styles.mediaDate}>{m.date}</span>
                    <h3 className={styles.mediaTitle}>{m.title}</h3>
                  </div>
                  <div className={styles.mediaBody}>
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: buildInstagramHtml(m.instagramUrl) 
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}