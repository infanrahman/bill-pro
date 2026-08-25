import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const exportToCSV = async (data: any[], filename: string) => {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header];
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(','))
  ].join('\n');

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: `${filename}.csv`,
        data: btoa(unescape(encodeURIComponent(csvContent))),
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        url: result.uri,
      });
    } catch (error) {
      console.error('Error saving or sharing CSV on mobile:', error);
    }
  } else {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportToPDF = async (
  title: string,
  headers: string[],
  data: any[][],
  filename: string
) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 35,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [66, 66, 66] }
  });

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: `${filename}.pdf`,
        data: pdfBase64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        url: result.uri,
      });
    } catch (error) {
      console.error('Error saving or sharing PDF on mobile:', error);
    }
  } else {
    doc.save(`${filename}.pdf`);
  }
};
