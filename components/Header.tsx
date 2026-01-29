"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext"; // これを使う

export default function Header() {
  const pathname = usePathname();
  // AuthContextから現在のユーザー情報と読み込み状態を取得
  const { user, userData, loading } = useAuth();

  const isSelected = (path: string) => (pathname === path ? "selected" : "");

  // ログイン中ならマイページへ、未ログインならログイン処理（またはトップのまま）
  // ※ 未ログイン時の遷移先は運用に合わせて "/" や "/login" に変えてもOK
  const profileLink = user ? "/mypage" : "/"; 

  return (
    <header className="main-header">
      <nav className="nav-container">
        <Link href="/" className={`nav-item ${isSelected("/")}`}>
          Home
        </Link>

        {/* loading中は何も出さない、もしくは薄く出すなどの処理を入れると
          アイコンがパッと切り替わる違和感が減ります
        */}
        {!loading && (
          <Link 
            href={profileLink} 
            className={`nav-item profile-nav ${isSelected("/mypage")}`}
          >
            <span className="nav-text">{user ? "MyPage" : "Login"}</span>
            <div className="header-user-icon">
              <img
                src={userData?.pictureUrl || "https://tappy-heartful.github.io/streak-connect-images/line-profile-unset.png"}
                alt="icon"
                id="header-icon-img"
              />
            </div>
          </Link>
        )}
      </nav>
    </header>
  );
}