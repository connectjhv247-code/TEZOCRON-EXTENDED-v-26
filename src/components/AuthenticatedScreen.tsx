import MainHomepageScreen from './MainHomepageScreen';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthenticatedScreenProps {
  user: FirebaseUser;
  userRole?: string;
  onSignOut: () => void;
  initialTargetProfileUserId?: string;
  initialIsFromRelateLink?: boolean;
}

export default function AuthenticatedScreen({
  user,
  userRole,
  onSignOut,
  initialTargetProfileUserId,
  initialIsFromRelateLink,
}: AuthenticatedScreenProps) {
  return (
    <MainHomepageScreen
      user={user}
      userRole={userRole}
      onSignOut={onSignOut}
      initialTargetProfileUserId={initialTargetProfileUserId}
      initialIsFromRelateLink={initialIsFromRelateLink}
    />
  );
}
