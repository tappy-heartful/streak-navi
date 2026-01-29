"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
// 1. 共通関数のインポートを追加
import { buildInstagramHtml } from "../lib/functions";
import "./home.css";
import Link from "next/link";

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

        // 2. データ取得後にInstagramに「解析して！」と命令する
        setTimeout(() => {
          if (window.instgrm) {
            window.instgrm.Embeds.process();
          }
        }, 500); // 少し余裕を持って実行
      } catch (e) {
        console.error("Medias fetch error:", e);
      } finally {
        setLoadingMedias(false);
      }
    }

    fetchLives();
    fetchMedias();
  }, []);

    // 2. 【ここを追加！】mediasが更新され、HTMLが描画された後にInstagramを実行する
  useEffect(() => {
    if (medias.length > 0) {
      // 0.1秒だけ待ってからInstagramにスキャンさせる
      const timer = setTimeout(() => {
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [medias]); // mediasが変わったときだけ動く

  return (
    <main>
      {/* HERO */}
      <section className="home-hero">
        <div className="home-hero-content">
          <h1 className="band-name">
            Swing Streak<br /><span className="sub-name"><span className="accent-j">J</span>azz Orchestra</span>
          </h1>
          <p className="tagline">BASED IN MATSUYAMA, EHIME</p>
        </div>
      </section>

      {/* UPCOMING LIVES */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">UPCOMING LIVES</h2>
          <div className="ticket-grid">
            {loadingLives ? (
              <p className="loading-text">Checking for upcoming lives...</p>
            ) : lives.length === 0 ? (
              <p className="no-data">No information available.</p>
            ) : (
              lives.map((live) => (
                <div key={live.id} className="ticket-card">
                  <div className="ticket-img-wrapper">
                    <img src={live.flyerUrl || 'https://tappy-heartful.github.io/streak-connect-images/favicon.png'} className="ticket-img" alt="flyer" />
                  </div>
                  <div className="ticket-info">
                    <div className="t-date">{live.date}</div>
                    <h3 className="t-title">{live.title}</h3>
                    <div className="t-details">
                      <div><i className="fa-solid fa-location-dot"></i> {live.venue}</div>
                      <div><i className="fa-solid fa-clock"></i> Open {live.open} / Start {live.start}</div>
                      <div><i className="fa-solid fa-ticket"></i> 前売：{live.advance}</div>
                    </div>
                    <Link href={`/live-detail/${live.id}`} className="btn-detail">詳細 / VIEW INFO</Link>
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
          <div className="concept-body">
            <p className="concept-lead">Swingは続く...</p>
            <div className="concept-text">
              <p>Swing Streak Jazz Orchestra（SSJO）は、2021年に結成されました。</p>
              <p>現役時代に築いた関係性が、これからも絶えることなく続いていきますように。</p>
            </div>
          </div>
        </div>
      </section>

      {/* MEMBERS */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">CORE MEMBERS</h2>
          <div className="member-grid">
            {members.map((m) => (
              <div key={m.name} className="member-card">
                <div className="member-img-wrapper">
                  <img src={`https://tappy-heartful.github.io/streak-connect-images/members/${m.name}.jpg`} alt={m.name} className="member-img" />
                </div>
                <div className="member-info-content">
                  <div className="member-role">{m.role}</div>
                  <div className="member-name">{m.name.split(' ').map((p, i) => <span key={i}>{p}<br/></span>)}</div>
                  <div className="member-origin">from {m.origin}</div>
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
          <div className="sns-container">
            <div className="sns-links">
              <a href="https://lin.ee/suVPLxR" target="_blank" className="sns-btn line-btn">LINE公式アカウント</a>
              <a href="https://www.instagram.com/swstjazz" target="_blank" className="sns-btn insta-btn">Instagram</a>
            </div>
          </div>
        </div>
      </section>

      {/* STORE */}
      <section className="content-section">
        <div className="inner">
          <h2 className="section-title">Official Store</h2>
          <div className="goods-container">
            <div className="horizontal-scroll">
              {goodsItems.map((item, i) => (
                <img key={i} src={`https://tappy-heartful.github.io/streak-connect-images/goods/${item}`} alt="Goods" className="square-img" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HISTORY */}
      <section className="content-section bg-darker">
        <div className="inner">
          <h2 className="section-title">HISTORY</h2>
          <div className="media-grid">
            {loadingMedias ? (
              <p>Loading archives...</p>
            ) : (
              medias.map((m) => (
                <div key={m.id} className="media-card">
                  <div className="media-info">
                    <span className="media-date">{m.date}</span>
                    <h3 className="media-title">{m.title}</h3>
                  </div>
                  <div className="media-body">
                    {/* 3. ここが重要！buildInstagramHtmlを通してHTMLとして流し込む */}
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