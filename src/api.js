/** GAS / ローカルモック API */

const isGas = () => typeof google !== 'undefined' && google?.script?.run;

function run(fnName, ...args) {
  return new Promise((resolve, reject) => {
    if (!isGas()) {
      reject(new Error('GAS 上で開いてください（npm run dev は画面確認用）'));
      return;
    }
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((err) => reject(err?.message ? err : new Error(String(err))))
      [fnName](...args);
  });
}

export const api = {
  getBootstrap: () => run('getBootstrap'),
  loginWithEmail: (email) => run('loginWithEmail', email),
  getShifts: (storeId, yearMonth, userEmail) => run('getShifts', storeId, yearMonth, userEmail),
  upsertShift: (payload) => run('upsertShift', payload),
  deleteShift: (shiftId, storeId, userEmail) => run('deleteShift', shiftId, storeId, userEmail),
};
