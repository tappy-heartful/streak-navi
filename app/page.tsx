import { redirect } from 'next/navigation';

export default function RootPage() {
  // アクセスがあったら即座に /connect へ転送する
  redirect('/connect');
}