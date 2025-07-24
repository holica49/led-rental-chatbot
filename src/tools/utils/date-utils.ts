export function calculateScheduleDates(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const installDate = new Date(start);
  installDate.setDate(installDate.getDate() - 1);
  
  const rehearsalDate = new Date(installDate);
  
  const dismantleDate = new Date(end);
  
  return {
    eventSchedule: `${startDate} ~ ${endDate}`,
    installSchedule: installDate.toISOString().split('T')[0],
    rehearsalSchedule: rehearsalDate.toISOString().split('T')[0],
    dismantleSchedule: dismantleDate.toISOString().split('T')[0]
  };
}