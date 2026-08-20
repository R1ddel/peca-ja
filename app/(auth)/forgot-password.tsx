import React from 'react';
import { CustomerAuthForm } from '@/components/CustomerAuthForm';

export default function ForgotPasswordScreen() {
  return <CustomerAuthForm initialMode="recover" />;
}
