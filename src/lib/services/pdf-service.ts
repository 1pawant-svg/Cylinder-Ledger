'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Transaction, Setting, TransactionType } from '@/lib/types';
import { adToBs, getCurrentADDate } from '@/lib/date-utils';

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

export async function generateCustomerLedgerPDF(
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

  const businessName = settings?.businessName || 'Cylindera LPG Pro';
  const businessAddress = settings?.address || '';
  const businessPhone = settings?.phone || '';

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, 14, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${businessAddress}${businessPhone ? ` | Tel: ${businessPhone}` : ''}`, 14, 25);
  
  doc.line(14, 28, 196, 28); // Divider

  // Customer Info Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(summary.isFiltered ? 'FILTERED STATEMENT' : 'CUSTOMER STATEMENT', 14, 38);

  doc.setFontSize(10);
  doc.text(`Name: ${customer.name}`, 14, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`Address: ${customer.address}`, 14, 51);
  doc.text(`Phone: ${customer.phone}`, 14, 56);
  if (customer.pan) doc.text(`PAN: ${customer.pan}`, 14, 61);

  // Report Info
  doc.text(`Report Date: ${adToBs(getCurrentADDate())} (${getCurrentADDate()})`, 140, 46);
  if (summary.dateRange) {
    doc.setFontSize(8);
    doc.text(`Period: ${summary.dateRange}`, 140, 51);
  }

  // Summary Box
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 70, 182, 35, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT SUMMARY', 18, 77);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  let yOffset = 83;
  if (summary.isFiltered) {
    doc.text('Opening Balance:', 18, yOffset);
    doc.text(`${summary.openingBalance || 0} PCS`, 55, yOffset);
    yOffset += 5;
  }

  doc.text('Period Issues (Out):', 18, yOffset);
  doc.text(`${summary.totalOut} PCS`, 55, yOffset);
  yOffset += 5;
  
  doc.text('Period Returns (In):', 18, yOffset);
  doc.text(`${summary.totalIn} PCS`, 55, yOffset);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Balance:', 110, 88);
  const balText = summary.balance === 0 
    ? 'SETTLED' 
    : summary.balance > 0 
      ? `${summary.balance} To Receive` 
      : `${Math.abs(summary.balance)} To Give`;
  
  doc.setTextColor(summary.balance > 0 ? 190 : (summary.balance < 0 ? 220 : 0), 0, 0);
  if (summary.balance === 0) doc.setTextColor(0, 150, 0);
  doc.text(balText, 145, 88);
  doc.setTextColor(0, 0, 0);

  // Transaction Table
  const tableRows = transactions.map((t) => {
    const impact = getTransactionImpact(t.type);
    const inQty = impact < 0 ? t.quantity : '-';
    const outQty = impact > 0 ? t.quantity : '-';
    
    return [
      t.bsDate,
      t.type.replace('_', ' '),
      inQty,
      outQty,
      t.runningBalance === 0 ? '0' : (t.runningBalance > 0 ? `${t.runningBalance} (R)` : `${Math.abs(t.runningBalance)} (G)`),
      t.remark || ''
    ];
  });

  autoTable(doc, {
    startY: 110,
    head: [['Date (BS)', 'Event Type', 'In Qty', 'Out Qty', 'Balance', 'Remarks']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50]
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 'auto' }
    },
    margin: { top: 20 },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${data.pageNumber}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        'This is a computer generated statement. - Powered by Cylindera LPG Pro',
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }
  });

  return doc;
}

export async function sharePDF(doc: jsPDF, filename: string, customerPhone?: string, customerName?: string) {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  // Native share is primarily for mobile devices
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Ledger Statement: ${customerName || 'Customer'}`,
        text: `Please find the attached cylinder movement statement for your records.`,
      });
      return true;
    } catch (err) {
      if ((err as any).name === 'AbortError') {
        return false;
      }
      console.error('Share failed, falling back to download', err);
      doc.save(filename);
    }
  } else {
    // Fallback for desktop: Download file + Open WhatsApp Web with a message
    doc.save(filename);
    
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      // Assuming Nepal (977) if number is 10 digits
      const phoneWithCountry = cleanPhone.length === 10 ? `977${cleanPhone}` : cleanPhone;
      const message = encodeURIComponent(`Namaste, I have just downloaded your latest cylinder ledger statement PDF. I am sending it to you now. Please check the attached file.`);
      const waUrl = `https://wa.me/${phoneWithCountry}?text=${message}`;
      
      // Short delay to ensure download starts before opening new tab
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 500);
    }
  }
  return false;
}