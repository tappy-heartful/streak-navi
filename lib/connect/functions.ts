import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  runTransaction,
  DocumentReference,
  Query,
  QuerySnapshot,
  DocumentSnapshot,
  collection, 
  query, 
  where, 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { showDialog } from "@/components/connect/CommonDialog"; // 先ほど作った共通ダイアログ

// --- 定数 ---
export const isTest = typeof window !== 'undefined' && window.location.hostname.includes('streak-connect-test');
export const globalAppName = isTest ? 'streakConnectTest' : 'streakConnect';
export const globalClientId = '2007808275';
export const globalAuthServerRender = 'https://streak-navi-auth-server-kz3v.onrender.com';

// --- セッション管理 (localStorage/sessionStorage) ---
const getStorageKey = (key: string) => `${globalAppName}.${key}`;

export function setSession(key: string, value: any) {
  if (typeof window === 'undefined') return;
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  sessionStorage.setItem(getStorageKey(key), val);
}

export function getSession(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(getStorageKey(key));
}

export function removeSession(key: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(getStorageKey(key));
}

export function clearAllAppSession() {
  if (typeof window === 'undefined') return;
  const prefix = globalAppName + '.';
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

// --- スピナー制御 (jQueryを使わず実装) ---
export function showSpinner() {
  if (typeof document === 'undefined') return;
  let overlay = document.getElementById('spinner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'spinner-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

export function hideSpinner() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('spinner-overlay');
  if (overlay) overlay.style.display = 'none';
}

// --- Instagram 埋め込み用 ---
export function buildInstagramHtml(url: string, includeWrapper = true): string {
  if (!url) return '';
  const instaUrl = url.split('?')[0];
  const html = `<blockquote class="instagram-media" data-instgrm-permalink="${instaUrl}" data-instgrm-version="14"></blockquote>`;
  return includeWrapper ? `<div class="instagram-embed">${html}</div>` : html;
}

// --- YouTube 埋め込み用 ---
export function extractYouTubeId(input: string): string {
  try {
    const url = new URL(input);
    return url.searchParams.get('v') || url.pathname.split('/').pop() || input;
  } catch {
    return input;
  }
}

export function buildYouTubeHtml(youtubeInput: string | string[], showNotice = false): string {
  if (!youtubeInput) return '';
  const videoIds = Array.isArray(youtubeInput) 
    ? youtubeInput.map(extractYouTubeId).filter(id => id.length === 11)
    : [extractYouTubeId(youtubeInput)].filter(id => id.length === 11);

  if (videoIds.length === 0) return '';
  const embedId = videoIds[0];
  const youtubeLink = Array.isArray(youtubeInput)
    ? `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(',')}`
    : `https://www.youtube.com/watch?v=${embedId}`;

  return `
    <div class="youtube-embed-wrapper">
      <div class="youtube-embed">
        <iframe src="https://www.youtube.com/embed/${embedId}?loop=1&playlist=${embedId}" allowfullscreen></iframe>
      </div>
      <div class="youtube-link-container">
        ${showNotice ? `<span class="youtube-notice">🔒限定公開</span>` : ''}
        <a href="${youtubeLink}" target="_blank" rel="noopener noreferrer">YouTubeでみる</a>
      </div>
    </div>`;
}

// --- 日付操作 ---
export function formatDateToYMDDot(dateInput: any): string {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// --- ログ記録 ---
export async function writeLog({ dataId, action, status = 'success', errorDetail = {} }: any) {
  try {
    const uid = getSession('uid') || 'unknown';
    const timestamp = new Date().getTime();
    const logId = `${timestamp}_${uid}`;
    const colName = status === 'success' ? 'connectLogs' : 'connectErrorLogs';
    await setDoc(doc(db, colName, logId), {
      uid,
      action,
      dataId,
      status,
      errorDetail,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Log failed", e);
  }
}

export async function archiveAndDeleteDoc(collectionName: string, docId: string) {
  const docRef = doc(db, collectionName, docId);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    // 削除前に 'archives' コレクションにコピー（履歴保存用）
    const archiveRef = doc(db, "archives", `${collectionName}_${docId}_${Date.now()}`);
    await setDoc(archiveRef, {
      ...snap.data(),
      archivedAt: serverTimestamp(),
      originalCollection: collectionName,
      originalId: docId
    });
    // 本番データを削除
    await deleteDoc(docRef);
  }
}

/**
 * チケット削除処理（TypeScript版）
 * @param liveId ライブドキュメントのID
 * @param uid ユーザーのUID
 * @param isConfirm 削除前に確認ダイアログを表示するか
 */
export async function deleteTicket(
  liveId: string, 
  uid: string | undefined, 
  isConfirm = true
): Promise<boolean> {
  // 1. 基本チェック
  if (!uid || !liveId) {
    console.error("UID or LiveID is missing");
    return false;
  }

  // 2. ユーザーへの最終確認
  if (isConfirm) {
    const ok = await showDialog(
      'この予約を取り消しますか？\n（この操作は元に戻せません）'
    );
    if (!ok) return false;
  }

  const ticketId = `${liveId}_${uid}`;

  try {
    showSpinner();

    // 3. トランザクション開始
    await runTransaction(db, async (transaction) => {
      const liveRef = doc(db, 'lives', liveId);
      const resRef = doc(db, 'tickets', ticketId);

      // データの取得
      const liveSnap = await transaction.get(liveRef);
      const resSnap = await transaction.get(resRef);

      if (!resSnap.exists()) {
        throw new Error('予約データが見つかりませんでした。');
      }

      const ticketData = resSnap.data();
      const cancelCount = ticketData.totalCount || 0; // 返却する人数

      // 4. 在庫の差し戻し
      if (liveSnap.exists()) {
        const currentTotalReserved = liveSnap.data().totalReserved || 0;
        // 計算結果がマイナスにならないようガード
        const newTotalReserved = Math.max(
          0,
          currentTotalReserved - cancelCount,
        );

        transaction.update(liveRef, {
          totalReserved: newTotalReserved,
        });
      }

      // 5. チケットの削除
      transaction.delete(resRef);
    });

    hideSpinner();
    await showDialog('予約を取り消しました', true);
    return true;

  } catch (e: any) {
    console.error("Delete ticket error:", e);
    
    // エラーログの記録（必要に応じて）
    await writeLog({
      dataId: ticketId,
      action: 'Ticket予約取消',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });

    hideSpinner();
    await showDialog(`エラーが発生しました: ${e.message}`, true);
    return false;

  } finally {
    hideSpinner();
  }
}

// すでに CommonDialog.tsx で export していますが、
// もし lib/functions.ts からも呼び出したい場合は再エクスポートしておくと便利です
export { showDialog };