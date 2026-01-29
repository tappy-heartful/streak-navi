"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [userIcon, setUserIcon] = useState("https://tappy-heartful.github.io/streak-connect-images/line-profile-unset.png");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ログイン状態の確認（一旦LocalStorageから取得する簡易版）
  useEffect(() => {
    const uid = sessionStorage.getItem("uid");
    const picUrl = sessionStorage.getItem("pictureUrl");
    
    if (uid) setIsLoggedIn(true);
    if (picUrl) setUserIcon(picUrl);
  }, []);

  // 現在のページかどうかを判定する関数
  const isSelected = (path: string) => pathname === path ? "selected" : "";

  return (
    <header className="main-header">
      <nav className="nav-container">
        {/* Linkタグを使うことで、ページ遷移が爆速（リロードなし）になります */}
        <Link href="/" className={`nav-item ${isSelected("/")}`}>
          Home
        </Link>

        <Link href="/mypage" className={`nav-item profile-nav ${isSelected("/mypage")}`}>
          <span className="nav-text">{isLoggedIn ? "MyPage" : "Login"}</span>
          <div className="header-user-icon">
            <img
              src={userIcon}
              alt="icon"
              id="header-icon-img"
            />
          </div>
        </Link>
      </nav>
    </header>
  );
}