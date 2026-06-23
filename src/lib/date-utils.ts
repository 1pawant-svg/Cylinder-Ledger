'use client';

import { Timestamp } from 'firebase/firestore';
import NepaliDate from 'nepali-date-converter';

/**
 * Safely pads a string to a target length.
 * Prevents RangeError: Invalid count value in buggy environments.
 */
const safePad = (val: string | number, targetLen: number = 2): string => {
  const s = String(val);
  if (s.length >= targetLen) return s;
  return s.padStart(targetLen, '0');
};

/**
 * Gets today's date in YYYY-MM-DD format strictly for Nepal timezone.
 */
export const getCurrentADDate = () => {
  try {
    const d = new Date();
    // Offset for Nepal Time (UTC+5:45)
    const nepalTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (345 * 60000));
    
    const year = nepalTime.getFullYear();
    const month = safePad(nepalTime.getMonth() + 1);
    const day = safePad(nepalTime.getDate());
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

/**
 * Converts AD Date string to BS Date string using nepali-date-converter.
 * @param adDateStr YYYY-MM-DD format AD date
 * @returns YYYY-MM-DD format BS date
 */
export const adToBs = (adDateStr: string): string => {
  if (!adDateStr) return "";
  try {
    const adDate = new Date(adDateStr);
    if (isNaN(adDate.getTime())) return "";
    
    const npDate = new NepaliDate(adDate);
    const y = npDate.getYear();
    const m = safePad(npDate.getMonth() + 1);
    const d = safePad(npDate.getDate());
    
    return `${y}-${m}-${d}`;
  } catch (e) {
    console.error("[DATE_UTILS] Error converting AD to BS:", e);
    return "";
  }
};

/**
 * Converts BS Date parts to AD Date string using nepali-date-converter.
 * @param bsYear BS Year string
 * @param bsMonth BS Month string (01-12)
 * @param bsDay BS Day string (01-32)
 * @returns YYYY-MM-DD format AD date
 */
export const bsToAd = (bsYear: string, bsMonth: string, bsDay: string): string => {
  try {
    const y = parseInt(bsYear);
    const m = parseInt(bsMonth);
    const d = parseInt(bsDay);
    
    if (isNaN(y) || isNaN(m) || isNaN(d)) return getCurrentADDate();

    // NepaliDate constructor: month is 0-indexed (0=Baisakh, 11=Chaitra)
    const npDate = new NepaliDate(y, m - 1, d);
    const adDate = npDate.toJsDate();
    
    const year = adDate.getFullYear();
    const month = safePad(adDate.getMonth() + 1);
    const day = safePad(adDate.getDate());
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("[DATE_UTILS] Error converting BS to AD:", e);
    return getCurrentADDate();
  }
};

/**
 * Nepali Month definitions for UI dropdowns
 */
export const BS_MONTHS = [
  { value: "01", label: "Baisakh" },
  { value: "02", label: "Jestha" },
  { value: "03", label: "Ashad" },
  { value: "04", label: "Shrawan" },
  { value: "05", label: "Bhadra" },
  { value: "06", label: "Ashwin" },
  { value: "07", label: "Kartik" },
  { value: "08", label: "Mangsir" },
  { value: "09", label: "Poush" },
  { value: "10", label: "Magh" },
  { value: "11", label: "Falgun" },
  { value: "12", label: "Chaitra" }
];

/**
 * Generates a list of BS years for selection
 */
export const getBSYears = () => {
  const years = [];
  // Standard range supported by most libraries
  for (let i = 2075; i <= 2095; i++) {
    years.push(i.toString());
  }
  return years;
};

/**
 * Formats a date string for display showing both BS and AD
 */
export const formatFullDate = (adDate: string) => {
  if (!adDate) return "";
  const bs = adToBs(adDate);
  return `${bs} BS (${adDate} AD)`;
};

/**
 * Converts various date formats (Timestamp, string, object) to milliseconds
 */
export const toMillis = (date: any): number => {
  if (!date) return 0;
  if (date instanceof Timestamp) return date.toMillis();
  if (typeof date === 'object' && 'seconds' in date) return date.seconds * 1000;
  const parsed = new Date(date).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Calculates the difference in days between two AD dates
 */
export const getDifferenceInDays = (adDate1: any, adDate2: any): number => {
  if (!adDate1 || !adDate2) return 0;
  const t1 = toMillis(adDate1);
  const t2 = toMillis(adDate2);
  const d1 = new Date(t1);
  const d2 = new Date(t2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};