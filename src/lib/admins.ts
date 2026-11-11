// Google accounts allowed to open the admin console.
//
// This list only controls the UI. The real authorization lives in the database:
// public.mindspark_admins is checked by the security-definer RPC functions
// (public.mindspark_is_admin, mindspark_dashboard_data, mindspark_dashboard_publish).
// To add or remove an administrator, update that table AND this list, then redeploy.
export const ADMIN_EMAILS: readonly string[] = [
  'zarsagency@gmail.com',
  'zarsagency7@gmail.com',
  'sadikurahman321@gmail.com',
];

export const isAdminEmail = (email?: string | null): boolean =>
  Boolean(email) && ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
