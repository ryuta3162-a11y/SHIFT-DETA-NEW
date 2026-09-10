/** バイト用 localStorage キー */
export const STAFF_TOKEN_KEY = 'shiftone_staff_token';
export const STAFF_CODE_KEY = 'shiftone_staff_code';

/**
 * アルバイト向けパスワード要件（4文字以上・内容は自由）
 * @returns {string|null} エラーメッセージ（OKなら null）
 */
export function validateStaffPassword(password, byeCode = '') {
  const p = String(password || '');
  if (p.length < 4) return 'パスワードは4文字以上にしてください';
  if (byeCode && p === String(byeCode)) return '社員コードと同じパスワードは使えません';
  return null;
}

export const STAFF_PASSWORD_HINT = '4文字以上（内容は自由）';
