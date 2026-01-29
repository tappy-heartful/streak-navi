import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div>&copy; 2025, 2026 Swing Streak Jazz Orchestra</div>
      <div className="developed-by">Developed by Takumi Fujimoto</div>
      <div className="footer-actions">
        {/* 内部リンクにする場合はLink、外部や別タブならaタグでOK */}
        <Link href="/connect/about" target="_blank">
          サイト情報
        </Link>
      </div>
      <div className="footer-sns">
        <a
          href="https://www.instagram.com/swstjazz?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
          target="_blank"
          rel="noopener noreferrer"
          className="instagram-link"
        >
          <i className="fa-brands fa-instagram"></i>
        </a>
      </div>
    </footer>
  );
}