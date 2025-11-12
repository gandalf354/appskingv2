/**
 * Format number dengan pemisah ribuan (Indonesia format)
 * @param value - string atau number yang akan diformat
 * @returns string dengan format pemisah ribuan
 */
export const formatNumberWithSeparator = (value: string | number): string => {
  // Convert to string and remove all non-digit characters
  const numericValue = value.toString().replace(/\D/g, '');
  
  // If empty, return empty string
  if (!numericValue) return '';
  
  // Convert to number and use toLocaleString with id-ID locale
  const number = parseInt(numericValue, 10);
  return number.toLocaleString('id-ID');
};

/**
 * Remove thousand separators and return clean number
 * @param formattedValue - string dengan pemisah ribuan
 * @returns string angka tanpa pemisah
 */
export const removeNumberSeparator = (formattedValue: string): string => {
  return formattedValue.replace(/\./g, '');
};

/**
 * Parse formatted number string to actual number
 * @param formattedValue - string dengan pemisah ribuan
 * @returns number value
 */
export const parseFormattedNumber = (formattedValue: string): number => {
  const cleanValue = removeNumberSeparator(formattedValue);
  return cleanValue ? parseInt(cleanValue, 10) : 0;
};

/**
 * Format input event for number fields
 * This function should be used in onChange handler
 */
export const handleNumberInput = (
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (value: string) => void
) => {
  const formatted = formatNumberWithSeparator(e.target.value);
  setter(formatted);
};

/**
 * Format number as currency (Rupiah)
 * @param value - number or string to format
 * @returns formatted currency string
 */
export const formatCurrency = (value: number | string): string => {
  // Convert string to number if needed, handle decimal strings from database
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `Rp ${formatNumberWithSeparator(Math.round(numValue))}`;
};
