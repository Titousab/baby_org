import { redirect } from 'next/navigation';
import { LogoMark } from '@/components/Icon';
import { getCurrentUser } from '@/lib/auth/current-user';
import { SignInForm } from './SignInForm';

export default async function SignInPage() {
  if (await getCurrentUser()) redirect('/');
  return (
    <main className="screen">
      <div className="auth gut">
        <div className="brand">
          <div className="logo">
            <LogoMark />
          </div>
          <h1>Ezra</h1>
          <p>For Ezra&apos;s family and caretakers</p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
