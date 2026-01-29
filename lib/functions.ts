// lib/functions.ts
import { db, auth } from './firebase'; // 前に作った設定ファイルからインポート
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// グローバル定数 (windowのチェックを入れる)
export const globalAppName = 'streakConnect'; 
export const globalBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

// --- セッション操作 (sessionStorageはブラウザにしかないのでガードを入れる) ---
export function setSession(key: string, value: any) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(globalAppName + '.' + key, value);
  }
}

export function getSession(key: string) {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(globalAppName + '.' + key);
  }
  return null;
}

// --- Instagram HTML生成 (ここが重要！) ---
export function buildInstagramHtml(url: string, includeWrapper = true) {
  if (!url) return '';
  // URLからクエリパラメータを削除
  const instaUrl = url.split('?')[0];
  // 埋め込み用のblockquoteタグを生成
  const html = `<blockquote class="instagram-media" data-instgrm-permalink="${instaUrl}" data-instgrm-version="14"></blockquote>`;
  return includeWrapper ? `<div class="instagram-embed">${html}</div>` : html;
}

// 他の関数（format, getDayOfWeekなど）もここにコピーしてOK