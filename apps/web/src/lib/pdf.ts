import { jsPDF } from "jspdf";

export function buildConsultancySlipPdf(opts: {
  clinicName: string;
  patientName: string;
  tierName: string;
  amount: number;
  currency: string;
}): string {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(opts.clinicName, 14, 20);
  doc.setFontSize(11);
  doc.text("Consultancy fee notice", 14, 32);
  doc.text(`Patient: ${opts.patientName}`, 14, 44);
  doc.text(`Tier: ${opts.tierName}`, 14, 54);
  doc.text(`Amount: ${opts.currency} ${opts.amount.toFixed(2)}`, 14, 64);
  doc.text(`Issued: ${new Date().toLocaleString()}`, 14, 76);
  return doc.output("datauristring");
}

export function buildReceiptPdf(opts: {
  clinicName: string;
  receiptNo: string;
  ticketCode: string;
  net: number;
  paid: number;
  currency: string;
}): string {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(opts.clinicName, 14, 20);
  doc.setFontSize(11);
  doc.text(`Receipt ${opts.receiptNo}`, 14, 32);
  doc.text(`Ticket: ${opts.ticketCode}`, 14, 44);
  doc.text(`Net: ${opts.currency} ${opts.net.toFixed(2)}`, 14, 54);
  doc.text(`Paid: ${opts.currency} ${opts.paid.toFixed(2)}`, 14, 64);
  doc.text(`Date: ${new Date().toLocaleString()}`, 14, 76);
  return doc.output("datauristring");
}
