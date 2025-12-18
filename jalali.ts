
export const getShamsiDate = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

export const getShamsiTime = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const getDayName = (date: Date): string => {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(date);
};

// Simplified Iranian Holidays (Sample for 1403/1404)
// In a real app, this should be fetched from an API or a more robust list
const IRANIAN_HOLIDAYS = [
  "1403/01/01", "1403/01/02", "1403/01/03", "1403/01/04", "1403/01/12", "1403/01/13",
  "1403/01/22", "1403/01/23", "1403/02/15", "1403/03/14", "1403/03/15", "1403/04/25",
  "1403/04/26", "1403/05/04", "1403/06/04", "1403/06/12", "1403/06/14", "1403/06/22",
  "1403/06/31", "1403/07/21", "1403/09/15", "1403/11/22", "1403/12/29"
];

export const isHoliday = (shamsiDate: string, date: Date): boolean => {
  // Check if it's Friday (Jomeh)
  if (date.getDay() === 5) return true;
  return IRANIAN_HOLIDAYS.includes(shamsiDate);
};

export const parseDuration = (ms: number): string => {
  const minutes = Math.floor(ms / (1000 * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} ساعت و ${m} دقیقه`;
};
