/**
 * Get current date in Asia/Jakarta timezone formatted as YYYY-MM-DD
 */
export const getJakartaDate = (): string => {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert ISO date string to YYYY-MM-DD format in Asia/Jakarta timezone
 */
export const formatDateToJakarta = (isoDateString: string): string => {
  if (!isoDateString) return '';
  const date = new Date(isoDateString);
  const jakartaTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date for display in Indonesian format (DD/MM/YYYY)
 */
export const formatDateDisplay = (isoDateString: string): string => {
  if (!isoDateString) return '';
  const date = new Date(isoDateString);
  const jakartaTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const year = jakartaTime.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Get current datetime in Asia/Jakarta timezone formatted as ISO string
 */
export const getJakartaDateTime = (): string => {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return jakartaTime.toISOString();
};
