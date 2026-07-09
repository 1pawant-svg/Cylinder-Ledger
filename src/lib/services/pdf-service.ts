
'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, TransactionType, Setting } from '@/lib/types';
import { adToBs, getCurrentADDate } from '@/lib/date-utils';
import { notoParams } from '@/lib/fonts/noto-sans-devanagari-regular';

/**
 * Registers the embedded Nepali font with jsPDF using standard VFS approach.
 */
function registerFonts(doc: jsPDF): string {
  try {
    if (!notoParams.base64 || notoParams.base64.trim() === '' || notoParams.base64.includes('(Paste Full Base64 Here)')) {
      console.warn('Nepali font data is missing or empty. Using default fonts.');
      return 'helvetica';
    }

    doc.addFileToVFS(notoParams.fileName, notoParams.base64);
    doc.addFont(notoParams.fileName, notoParams.fontName, 'normal');
    doc.addFont(notoParams.fileName, notoParams.fontName, 'bold');
    
    console.log(`PDF Service: Registered ${notoParams.fontName}`);
    return notoParams.fontName;
  } catch (error) {
    console.error('Failed to register embedded fonts:', error);
    return 'helvetica';
  }
}

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

/**
 * Generates a professional Customer Ledger PDF.
 */
export async function generateCustomerLedgerPDF(
  t: (key: any) => string,
  customer: Customer,
  transactions: any[],
  settings: Setting | null,
  summary: {
    totalIn: number;
    totalOut: number;
    balance: number;
    isFiltered?: boolean;
    openingBalance?: number;
    dateRange?: string;
  }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const mainFont = registerFonts(doc);

  const businessName = settings?.businessName || 'PGS Cylinder Ledger';
  const businessAddress = settings?.address || '';
  const businessPhone = settings?.phone || '';

  // Header
  doc.setFont(mainFont, 'bold');
  doc.setFontSize(22);
  doc.text(businessName.toUpperCase(), 14, 22);

  doc.setFont(mainFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${businessAddress}${businessPhone ? ` | ${t('phone')}: ${businessPhone}` : ''}`, 14, 28);
  
  doc.setDrawColor(200);
  doc.line(14, 32, 196, 32);

  // Customer Info Section
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont(mainFont, 'bold');
  const title = summary.isFiltered ? t('filteredStatement').toUpperCase() : t('ledgerStatement').toUpperCase();
  doc.text(title, 14, 42);

  doc.setFontSize(10);
  doc.text(`${t('name')}: ${customer.name}`, 14, 50);
  doc.setFont(mainFont, 'normal');
  doc.setTextColor(80);
  doc.text(`${t('address')}: ${customer.address}`, 14, 55);
  doc.text(`${t('phone')}: ${customer.phone}`, 14, 60);
  if (customer.pan) doc.text(`${t('pan')}: ${customer.pan}`, 14, 65);

  // Report Info
  doc.setTextColor(100);
  doc.text(`${t('reportDate')}: ${adToBs(getCurrentADDate())} BS`, 140, 50);
  if (summary.dateRange) {
    doc.setFontSize(9);
    doc.text(`${t('period')}: ${summary.dateRange}`, 140, 56);
  }

  // Summary Box
  doc.setFillColor(248, 249, 250);
  doc.rect(14, 75, 182, 35, 'F');
  doc.setDrawColor(220);
  doc.rect(14, 75, 182, 35, 'S');
  
  doc.setFontSize(10);
  doc.setFont(mainFont, 'bold');
  doc.setTextColor(0);
  doc.text(t('accountSummary').toUpperCase(), 20, 83);
  
  doc.setFontSize(9);
  doc.setFont(mainFont, 'normal');
  doc.setTextColor(80);
  
  let yOffset = 90;
  if (summary.isFiltered) {
    doc.text(`${t('openingBalance')}:`, 20, yOffset);
    doc.text(`${summary.openingBalance || 0} ${t('pcs')}`, 60, yOffset);
    yOffset += 5;
  }

  doc.text(`${t('totalIssued')}:`, 20, yOffset);
  doc.text(`${summary.totalOut} ${t('pcs')}`, 60, yOffset);
  yOffset += 5;
  
  doc.text(`${t('totalReturned')}:`, 20, yOffset);
  doc.text(`${summary.totalIn} ${t('pcs')}`, 60, yOffset);

  // Net Balance Highlight
  doc.setFontSize(12);
  doc.setFont(mainFont, 'bold');
  doc.setTextColor(0);
  doc.text(`${t('netBalanceCurrent')}:`, 110, 93);
  
  const balValue = Math.abs(summary.balance);
  const balLabel = summary.balance === 0 
    ? t('settled') 
    : `${balValue} ${summary.balance > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}`;
  
  if (summary.balance > 0) doc.setTextColor(184, 134, 11); 
  else if (summary.balance < 0) doc.setTextColor(16, 185, 129); 
  else doc.setTextColor(16, 185, 129);
  
  doc.text(balLabel, 110, 100);
  doc.setTextColor(0);

  // Transaction Table
  const tableRows = transactions.map((txn) => {
    const impact = getTransactionImpact(txn.type);
    const inQty = impact < 0 ? txn.quantity : '-';
    const outQty = impact > 0 ? txn.quantity : '-';
    
    let displayType = txn.type.replace('_', ' ');
    const upper = txn.type.toUpperCase();
    if (upper === 'OUT' || upper === 'OUT_FULL') displayType = t('labelOut');
    else if (upper === 'IN' || upper === 'IN_EMPTY') displayType = t('labelIn');
    else if (upper === 'LEAKAGE') displayType = t('leakageReturn');
    else if (upper === 'LOST') displayType = t('cylinderLost');
    else if (upper === 'ADJUSTMENT') displayType = t('balanceAdjustment');

    const balanceLabel = txn.runningBalance === 0 
      ? '0' 
      : `${Math.abs(txn.runningBalance)} ${txn.runningBalance > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}`;

    return [
      txn.bsDate,
      displayType,
      inQty,
      outQty,
      balanceLabel,
      txn.remark || ''
    ];
  });

  autoTable(doc, {
    startY: 118,
    head: [[t('dateBs'), t('type'), t('labelIn'), t('labelOut'), t('running'), t('remarks')]],
    body: tableRows,
    theme: 'grid',
    styles: { font: mainFont },
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      font: mainFont
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [45, 45, 45],
      valign: 'middle',
      font: mainFont
    },
    columnStyles: {
      0: { cellWidth: 32 }, 
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 35, halign: 'center' },
      5: { cellWidth: 'auto' }
    },
    margin: { top: 20 },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setFont(mainFont, 'normal');
      doc.setTextColor(150);
      doc.text(
        `${t('page')} ${data.pageNumber}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        t('computerGeneratedLedger'),
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }
  });

  return doc;
}

/**
 * Generates a PDF of the Customer List (Summary report).
 */
export async function generateCustomerListPDF(
  t: (key: any) => string,
  customers: any[],
  settings: Setting | null,
  options: {
    title: string;
    filterLabel?: string;
  }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const mainFont = registerFonts(doc);

  const businessName = settings?.businessName || 'PGS Cylinder Ledger';
  const businessAddress = settings?.address || '';
  const businessPhone = settings?.phone || '';

  // Header
  doc.setFont(mainFont, 'bold');
  doc.setFontSize(20);
  doc.text(businessName.toUpperCase(), 14, 20);

  doc.setFont(mainFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${businessAddress}${businessPhone ? ` | ${t('phone')}: ${businessPhone}` : ''}`, 14, 25);
  
  doc.setDrawColor(200);
  doc.line(14, 28, 196, 28);

  // Title
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont(mainFont, 'bold');
  doc.text(options.title.toUpperCase(), 14, 38);

  if (options.filterLabel) {
    doc.setFontSize(10);
    doc.setFont(mainFont, 'normal');
    doc.setTextColor(80);
    doc.text(`${t('filterApplied')}: ${options.filterLabel}`, 14, 43);
  }

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${t('reportGenerated')}: ${adToBs(getCurrentADDate())} BS`, 140, 38);

  const tableRows = customers.map((c) => {
    const bal = c.balance || 0;
    const balanceLabel = bal === 0 
      ? t('settled') 
      : `${Math.abs(bal)} ${bal > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}`;
    
    return [
      c.name,
      c.phone,
      c.address,
      balanceLabel
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [[t('name'), t('phone'), t('address'), t('netBalance')]],
    body: tableRows,
    theme: 'grid',
    styles: { font: mainFont },
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      font: mainFont
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [45, 45, 45],
      font: mainFont
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 45 },
      3: { cellWidth: 35, halign: 'center' }
    },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setFont(mainFont, 'normal');
      doc.setTextColor(150);
      doc.text(
        `${t('page')} ${data.pageNumber} | PGS Cylinder Ledger System`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  });

  return doc;
}

export async function sharePDF(doc: jsPDF, filename: string, customerPhone?: string, customerName?: string) {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Ledger: ${customerName || 'Summary report'}`,
        text: `Cylinder ledger statement for ${customerName || 'multiple accounts'}.`,
      });
      return true;
    } catch (err) {
      if ((err as any).name === 'AbortError') return false;
      doc.save(filename);
    }
  } else {
    doc.save(filename);
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.length === 10 ? `977${cleanPhone}` : cleanPhone;
      const message = encodeURIComponent(`Namaste, I am sending your latest cylinder ledger statement as a PDF. Please check the attachment.`);
      const waUrl = `https://wa.me/${phoneWithCountry}?text=${message}`;
      setTimeout(() => window.open(waUrl, '_blank'), 500);
    }
  }
  return false;
}
