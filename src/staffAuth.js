/** バイト用 localStorage キー */
export const STAFF_TOKEN_KEY = 'shiftone_staff_token';
export const STAFF_CODE_KEY = 'shiftone_staff_code';

/**
 * 一般的なパスワード要件（8文字以上・英字と数字を各1文字以上）
 * @returns {string|null} エラーメッセージ（OKなら null）
 */
export function validateStaffPassword(password, byeCode = '') {
  const p = String(password || '');
  if (p.length < 8) return 'パスワードは8文字以上にしてください';
  if (!/[A-Za-z]/.test(p)) return '英字を1文字以上含めてください';
  if (!/[0-9]/.test(p)) return '数字を1文字以上含めてください';
  if (byeCode && p === String(byeCode)) return '社員コードと同じパスワードは使えません';
  return null;
}

export const STAFF_PASSWORD_HINT = '8文字以上・英字と数字をそれぞれ1文字以上';
