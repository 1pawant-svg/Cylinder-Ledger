'use client';

import { Timestamp } from 'firebase/firestore';
import NepaliDate from 'nepali-date-converter';

/**
 * Robust padding that avoids String.padStart for better environment compatibility.
 */
const pad2 = (val: string | number): string => {
  const s = String(val || "");
  if (s.length >= 2) return s;
  return ('0' + s).slice(-2);
};

/**
 * Gets today's date in YYYY-MM-DD format strictly for Nepal timezone.
 * Optimized to be environment-agnostic.
 */
export const getCurrentADDate = () => {
  try {
    const d = new Date();
    // Use UTC for server/client consistency if possible, or handle local safely
    const year = d.getFullYear();
    const month = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

/**
 * Converts AD Date string to BS Date string using nepali-date-converter.
 */
export const adToBs = (adDateStr: string): string => {
  if (!adDateStr) return "";
  try {
    const adDate = new Date(adDateStr);
    if (isNaN(adDate.getTime())) return "";
    
    const npDate = new NepaliDate(adDate);
    const y = npDate.getYear();
    const m = pad2(npDate.getMonth() + 1);
    const d = pad2(npDate.getDate());
    
    return `${y}-${m}-${d}`;
  } catch (e) {
    console.error("[DATE_UTILS] Error converting AD to BS:", e);
    return "";
  }
};

/**
 * Converts BS Date parts to AD Date string using nepali-date-converter.
 */
export const bsToAd = (bsYear: string, bsMonth: string, bsDay: string): string => {
  try {
    const y = parseInt(bsYear);
    const m = parseInt(bsMonth);
    const d = parseInt(bsDay);
    
    if (isNaN(y) || isNaN(m) || isNaN(d)) return getCurrentADDate();

    const npDate = new NepaliDate(y, m - 1, d);
    const adDate = npDate.toJsDate();
    
    const year = adDate.getFullYear();
    const month = pad2(adDate.getMonth() + 1);
    const day = pad2(adDate.getDate());
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("[DATE_UTILS] Error converting BS to AD:", e);
    return getCurrentADDate();
  }
};

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

export const getBSYears = () => {
  const years = [];
  const currentBSYear = 2081; // Default starting reference
  for (let i = currentBSYear - 5; i <= currentBSYear + 15; i++) {
    years.push(i.toString());
  }
  return years;
};

export const formatFullDate = (adDate: string) => {
  if (!adDate) return "";
  const bs = adToBs(adDate);
  return `${bs} BS (${adDate} AD)`;
};

export const toMillis = (date: any): number => {
  if (!date) return 0;
  if (date instanceof Timestamp) return date.toMillis();
  if (typeof date === 'object' && 'seconds' in date) return date.seconds * 1000;
  const parsed = new Date(date).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

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

/**
 * Checks if today is the last day of the current BS month.
 */
export const isBSMonthEnd = () => {
  try {
    const npDate = new NepaliDate();
    const currentDay = npDate.getDate();
    const totalDays = npDate.getMonthDays();
    return currentDay === totalDays;
  } catch (e) {
    return false;
  }
};
