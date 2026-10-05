'use client';

import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

// Brand splash shown on a full page open/refresh: the Tiny Torque logo fades + scales in (the
// prototype's splashFadeIn motion, D-045), holds ~1s so it reads clearly, then fades out and
// unmounts. Client-side navigations don't remount the root layout, so it doesn't flash between
// in-app pages — only on a real page load.
export default function Splash() {
  const [phase, setPhase] = useState<'show' | 'fading' | 'done'>('show');

  useEffect(() => {
    const hold = setTimeout(() => setPhase('fading'), 1000); // keep the logo visible ~1s
    const remove = setTimeout(() => setPhase('done'), 1500); // after the 0.5s fade, unmount
    return () => {
      clearTimeout(hold);
      clearTimeout(remove);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className={`${styles.splash} ${phase === 'fading' ? styles.fading : ''}`}
      aria-hidden="true"
      data-splash=""
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.logo} src="/tiny-torque-logo.webp" alt="Tiny Torque" />
    </div>
  );
}
