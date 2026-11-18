import { jsPDF } from "jspdf";

export function createReportPdf(report: string) {
  const doc = new jsPDF();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  const rowHeight = 4.8;
  const bodyTop = 42;
  const rowsPerPage = Math.floor((height - bodyTop - 24) / rowHeight);

  doc.setProperties({ title: "Credit Card Utilisation Management Simulator" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines: string[] = doc.splitTextToSize(report, width - margin * 2);
  const pageCount = Math.max(1, Math.ceil(lines.length / rowsPerPage));
  for (let page = 0; page < pageCount; page++) {
    if (page) doc.addPage();
    doc.setFillColor(16, 34, 57);
    doc.rect(0, 0, width, 31, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Credit Card Utilisation Management Simulator", margin, 15);
    doc.setFontSize(10);
    doc.text("SIMULATION ONLY  |  ASSIGNMENT REPORT", margin, 24);
    doc.setTextColor(23, 32, 51);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const start = page * rowsPerPage;
    lines.slice(start, start + rowsPerPage).forEach((line, index) => {
      doc.text(line, margin, bodyTop + index * rowHeight);
    });
    doc.setDrawColor(204, 215, 222);
    doc.line(margin, height - 19, width - margin, height - 19);
    doc.text(`Page ${page + 1} of ${pageCount}`, width - margin, height - 12, { align: "right" });
  }
  return doc;
}
