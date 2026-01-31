import { redirect } from 'next/navigation';

export default function RootPage() {
  // アクセスがあったら即座に /home へ転送する
  redirect('/home');
}