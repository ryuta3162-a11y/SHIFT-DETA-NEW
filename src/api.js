/** GAS API */

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
  saveJurisdiction: (payload) => run('saveJurisdiction', payload),
  listEmployees: (storeId, userEmail) => run('listEmployees', storeId, userEmail),
  upsertEmployee: (payload) => run('upsertEmployee', payload),
  deactivateEmployee: (employeeId, storeId, userEmail) => run('deactivateEmployee', employeeId, storeId, userEmail),
  getWeeklySchedule: (storeId, userEmail) => run('getWeeklySchedule', storeId, userEmail),
  saveWeeklySchedule: (payload) => run('saveWeeklySchedule', payload),
  getShifts: (storeId, yearMonth, userEmail) => run('getShifts', storeId, yearMonth, userEmail),
  generateMonthlyShifts: (payload) => run('generateMonthlyShifts', payload),
  upsertShift: (payload) => run('upsertShift', payload),
  upsertShiftsBatch: (payload) => run('upsertShiftsBatch', payload),
  upsertMemosBatch: (payload) => run('upsertMemosBatch', payload),
  deleteShift: (shiftId, storeId, userEmail) => run('deleteShift', shiftId, storeId, userEmail),
  buildByeByePaste: (storeId, yearMonth, userEmail) => run('buildByeByePaste', storeId, yearMonth, userEmail),
};
