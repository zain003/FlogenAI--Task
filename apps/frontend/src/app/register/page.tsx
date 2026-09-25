import React from 'react';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata = {
  title: 'Create Account — FlogenAI Marketplace',
  description: 'Join FlogenAI Marketplace as a Customer or Service Provider.',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <RegisterForm />
    </div>
  );
}
