import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Lead, Product } from '../types';
import { formatCurrencyMXN, formatShortDate, getFinalPrice } from './formatters';

export async function exportCatalogToExcel(
  products: Product[],
  filename = 'catalogo-joyeria-hi.xlsx'
): Promise<void> {
  const headerRow = [
    'SKU',
    'Nombre',
    'Categoría',
    'Material',
    'Quilataje',
    'Precio Lista (MXN)',
    'Descuento (%)',
    'Precio Final (MXN)',
    '6 MSI (MXN/mes)',
    '12 MSI (MXN/mes)',
    'Disponibilidad',
    'Consultas',
    'Descripción',
  ].map((label) => ({
    value: label,
    fontWeight: 'bold' as const,
    backgroundColor: '#18181B',
    color: '#FAF9F7',
  }));

  const dataRows = products.map((p) => {
    const finalPrice = getFinalPrice(p.price, p.discountPercent);
    return [
      { type: String, value: p.sku },
      { type: String, value: p.name },
      { type: String, value: p.category },
      { type: String, value: p.material },
      { type: String, value: p.karat },
      { type: Number, value: p.price, format: '#,##0' },
      { type: Number, value: p.discountPercent },
      { type: Number, value: finalPrice, format: '#,##0' },
      { type: Number, value: Math.round(finalPrice / 6), format: '#,##0' },
      { type: Number, value: Math.round(finalPrice / 12), format: '#,##0' },
      { type: String, value: p.available ? 'Disponible' : 'Agotado' },
      { type: Number, value: p.views },
      { type: String, value: p.description },
    ];
  });

  const sheetData: SheetData = [headerRow, ...dataRows];

  await writeXlsxFile([
    {
      data: sheetData,
      columns: [
        { width: 14 },
        { width: 32 },
        { width: 14 },
        { width: 16 },
        { width: 12 },
        { width: 18 },
        { width: 14 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 15 },
        { width: 12 },
        { width: 48 },
      ],
      sheet: 'Catálogo Joyería HI',
    },
  ]).toFile(filename);
}

export function exportCatalogToPDF(
  products: Product[],
  filename = 'catalogo-joyeria-hi.pdf'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(24, 24, 27);
  doc.text('Joyería HI — Catálogo Oficial', 40, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 108);
  doc.text(
    `Generado el ${formatShortDate(new Date().toISOString())} · ${products.length} piezas registradas`,
    40,
    62
  );

  const body = products.map((p) => {
    const finalPrice = getFinalPrice(p.price, p.discountPercent);
    return [
      p.sku,
      p.name,
      p.category,
      `${p.material} ${p.karat}`,
      formatCurrencyMXN(p.price),
      p.discountPercent > 0 ? `${p.discountPercent}%` : '—',
      formatCurrencyMXN(finalPrice),
      formatCurrencyMXN(Math.round(finalPrice / 12)) + '/mes',
      p.available ? 'Disponible' : 'Agotado',
    ];
  });

  autoTable(doc, {
    startY: 78,
    head: [
      [
        'SKU',
        'Pieza',
        'Categoría',
        'Material',
        'Precio Lista',
        'Dto.',
        'Precio Final',
        '12 MSI',
        'Estado',
      ],
    ],
    body,
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [24, 24, 27],
    },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [250, 249, 247],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [247, 245, 240],
    },
  });

  doc.save(filename);
}

export async function exportLeadsToExcel(
  leads: Lead[],
  filename = 'clientes-interesados-joyeria-hi.xlsx'
): Promise<void> {
  const headerRow = [
    'Fecha',
    'Nombre',
    'Teléfono / WhatsApp',
    'Correo',
    'Producto de Interés',
    'Origen',
    'Estado',
    'Mensaje',
  ].map((label) => ({
    value: label,
    fontWeight: 'bold' as const,
    backgroundColor: '#18181B',
    color: '#FAF9F7',
  }));

  const dataRows = leads.map((lead) => [
    { type: String, value: formatShortDate(lead.createdAt) },
    { type: String, value: lead.name },
    { type: String, value: lead.phone },
    { type: String, value: lead.email },
    { type: String, value: lead.productName },
    {
      type: String,
      value: lead.source === 'ficha' ? 'Ficha de producto' : 'Formulario de contacto',
    },
    {
      type: String,
      value:
        lead.status === 'nuevo'
          ? 'Nuevo'
          : lead.status === 'contactado'
          ? 'Contactado'
          : 'Cerrado',
    },
    { type: String, value: lead.message || '' },
  ]);

  const sheetData: SheetData = [headerRow, ...dataRows];

  await writeXlsxFile([
    {
      data: sheetData,
      columns: [
        { width: 16 },
        { width: 26 },
        { width: 20 },
        { width: 28 },
        { width: 28 },
        { width: 22 },
        { width: 14 },
        { width: 42 },
      ],
      sheet: 'Clientes Interesados',
    },
  ]).toFile(filename);
}

export function exportLeadsToPDF(
  leads: Lead[],
  filename = 'clientes-interesados-joyeria-hi.pdf'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(24, 24, 27);
  doc.text('Joyería HI — Clientes Interesados', 40, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 108);
  doc.text(
    `Reporte generado el ${formatShortDate(new Date().toISOString())} · ${leads.length} registros`,
    40,
    62
  );

  const body = leads.map((lead) => [
    formatShortDate(lead.createdAt),
    lead.name,
    lead.phone,
    lead.email,
    lead.productName,
    lead.status === 'nuevo'
      ? 'Nuevo'
      : lead.status === 'contactado'
      ? 'Contactado'
      : 'Cerrado',
    lead.message ? lead.message.slice(0, 60) : '—',
  ]);

  autoTable(doc, {
    startY: 78,
    head: [
      [
        'Fecha',
        'Nombre',
        'Teléfono / WhatsApp',
        'Correo',
        'Pieza de Interés',
        'Estado',
        'Notas',
      ],
    ],
    body,
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [24, 24, 27],
    },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [250, 249, 247],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [247, 245, 240],
    },
  });

  doc.save(filename);
}
