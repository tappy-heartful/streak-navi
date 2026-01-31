import { redirect } from 'next/navigation';

export default function RootPage() {
  // アクセスがあったら即座に /navi/login へ転送する
  redirect('/navi/login');
}