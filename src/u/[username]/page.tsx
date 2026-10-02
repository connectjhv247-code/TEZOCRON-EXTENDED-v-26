import React from 'react';
import UserProfileRoute from '../../components/UserProfileRoute';
import { auth } from '../../lib/firebase';

interface PageProps {
  params?: {
    username?: string;
  };
}

export default function UserProfilePage({ params }: PageProps) {
  const username = params?.username;
  const currentUser = auth.currentUser;

  return (
    <UserProfileRoute
      username={username}
      currentUser={currentUser}
      onBack={() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }}
    />
  );
}
