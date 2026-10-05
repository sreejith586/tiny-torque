import type { ReactNode } from 'react';
import styles from './auth.module.css';

// Centres the auth forms (login, onboarding) in a readable column so they don't stretch across
// the widened app shell (D-052) on tablet and laptop. Grid screens keep the full shell width.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={styles.authShell}>{children}</div>;
}
