import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    // Never ship phone numbers (D-014 / 02 §5 privacy).
    if (event.request?.data && typeof event.request.data === 'string') {
      event.request.data = event.request.data.replace(/\+?\d{10,15}/g, '[phone]');
    }
    return event;
  },
});
