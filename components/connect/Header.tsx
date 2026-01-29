"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/connect/AuthContext";
import { globalAuthServerRender, showSpinner, hideSpinner } from "@/lib/connect/functions";

export default function Header() {
  const pathname = usePathname();
  const { user, userData, loading } = useAuth();

  const isSelected = (path: string) => (pathname === path ? "selected" : "");

  /**
   * ログイン/マイページ クリック時のハンドリング
   */
  const handleProfileClick = async (e: React.MouseEvent) => {
    // 未ログイン時のみログイン処理を実行
    if (!user) {
      e.preventDefault(); // 通常のLink遷移をキャンセル
      
      try {
        showSpinner();
        // 現在のページをリダイレクト先に指定（ログイン後にここに戻るため）
        const currentUrl = window.location.href;
        const fetchUrl = `${globalAuthServerRender}/get-line-login-url?redirectAfterLogin=${encodeURIComponent(currentUrl)}`;

        const res = await fetch(fetchUrl);
        const { loginUrl } = await res.json();

        if (loginUrl) {
          window.location.href = loginUrl;
        } else {
          throw new Error("ログインURLの取得に失敗しました");
        }
      } catch (err) {
        console.error(err);
        alert("ログイン処理中にエラーが発生しました。");
        hideSpinner();
      }
    }
    // ログイン済みの場合は、Linkタグの本来の挙動で /mypage へ遷移する
  };

  return (
    <header className="main-header">
      <nav className="nav-container">
        <Link href="/connect" className={`nav-item ${isSelected("/")}`}>
          Home
        </Link>

        {!loading && (
          <Link
            href="/connect/mypage"
            onClick={handleProfileClick}
            className={`nav-item profile-nav ${isSelected("/mypage")}`}
          >
            <span className="nav-text">{user ? "MyPage" : "Login"}</span>
            <div className="header-user-icon">
              <img
                src={
                  userData?.pictureUrl ||
                  "https://tappy-heartful.github.io/streak-connect-images/line-profile-unset.png"
                }
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