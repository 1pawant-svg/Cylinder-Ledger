
'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, TransactionType, Setting } from '@/lib/types';
import { adToBs, getCurrentADDate } from '@/lib/date-utils';

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

/**
 * Generates a professional Customer Ledger PDF.
 * Note: Uses English structural labels to ensure 100% compatibility across all PDF viewers.
 */
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

  // Labels used in the PDF
  const l = {
    toReceive: 'To Receive',
    toGive: 'To Give',
    in: 'IN',
    out: 'OUT',
    settled: 'Settled',
    dateBs: 'Date (BS)',
    eventType: 'Type',
    qtyIn: 'IN',
    qtyOut: 'OUT',
    balance: 'Balance',
    remarks: 'Remarks'
  };

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName.toUpperCase(), 14, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${businessAddress}${businessPhone ? ` | Tel: ${businessPhone}` : ''}`, 14, 28);
  
  doc.setDrawColor(200);
  doc.line(14, 32, 196, 32);

  // Customer Info Section
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = summary.isFiltered ? 'FILTERED ACCOUNT STATEMENT' : 'CUSTOMER LEDGER STATEMENT';
  doc.text(title, 14, 42);

  doc.setFontSize(10);
  doc.text(`Customer Name: ${customer.name}`, 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text(`Address: ${customer.address}`, 14, 55);
  doc.text(`Phone: ${customer.phone}`, 14, 60);
  if (customer.pan) doc.text(`PAN: ${customer.pan}`, 14, 65);

  // Report Info
  doc.setTextColor(100);
  doc.text(`Report Date: ${adToBs(getCurrentADDate())} BS`, 140, 50);
  if (summary.dateRange) {
    doc.setFontSize(9);
    doc.text(`Period: ${summary.dateRange}`, 140, 56);
  }

  // Summary Box
  doc.setFillColor(248, 249, 250);
  doc.rect(14, 75, 182, 35, 'F');
  doc.setDrawColor(220);
  doc.rect(14, 75, 182, 35, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('ACCOUNT SUMMARY', 20, 83);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  
  let yOffset = 90;
  if (summary.isFiltered) {
    doc.text('Opening Balance:', 20, yOffset);
    doc.text(`${summary.openingBalance || 0} PCS`, 60, yOffset);
    yOffset += 5;
  }

  doc.text(`Total Issued (${l.out}):`, 20, yOffset);
  doc.text(`${summary.totalOut} PCS`, 60, yOffset);
  yOffset += 5;
  
  doc.text(`Total Returned (${l.in}):`, 20, yOffset);
  doc.text(`${summary.totalIn} PCS`, 60, yOffset);

  // Net Balance Highlight
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Net Balance (Current):', 110, 93);
  
  const balValue = Math.abs(summary.balance);
  const balLabel = summary.balance === 0 
    ? l.settled 
    : summary.balance > 0 
      ? `${balValue} ${l.toReceive}` 
      : `${balValue} ${l.toGive}`;
  
  // Color coding for balance (Golden for Receive, Emerald for Give)
  if (summary.balance > 0) doc.setTextColor(184, 134, 11); // Dark Golden Rod
  else if (summary.balance < 0) doc.setTextColor(16, 185, 129); // Emerald
  else doc.setTextColor(16, 185, 129);
  
  doc.text(balLabel, 110, 100);
  doc.setTextColor(0);

  // Transaction Table
  const tableRows = transactions.map((t) => {
    const impact = getTransactionImpact(t.type);
    const inQty = impact < 0 ? t.quantity : '-';
    const outQty = impact > 0 ? t.quantity : '-';
    
    let displayType = t.type.replace('_', ' ');
    const upper = t.type.toUpperCase();
    if (upper === 'OUT' || upper === 'OUT_FULL') displayType = 'OUT';
    else if (upper === 'IN' || upper === 'IN_EMPTY') displayType = 'IN';

    const balanceLabel = t.runningBalance === 0 
      ? '0' 
      : (t.runningBalance > 0 
          ? `${t.runningBalance} Receive` 
          : `${Math.abs(t.runningBalance)} Give`
        );

    return [
      t.bsDate,
      displayType,
      inQty,
      outQty,
      balanceLabel,
      t.remark || ''
    ];
  });

  autoTable(doc, {
    startY: 118,
    head: [[l.dateBs, l.eventType, l.qtyIn, l.qtyOut, l.balance, l.remarks]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [45, 45, 45],
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 32 }, // Fixed width for date
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 35, halign: 'center' },
      5: { cellWidth: 'auto' }
    },
    margin: { top: 20 },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        'Computer generated ledger. Powered by Cylindera LPG Pro.',
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

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Ledger: ${customerName || 'Customer'}`,
        text: `Cylinder ledger statement for ${customerName}.`,
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
