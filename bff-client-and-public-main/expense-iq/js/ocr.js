/**
 * Expense IQ™ — local (on-device) receipt OCR
 * No API key, no network call — Tesseract.js runs entirely in the browser.
 */
(function () {
  window.EIQ = window.EIQ || {};

  async function localExtract(imageDataUrl) {
    const {
      data: { text },
    } = await Tesseract.recognize(imageDataUrl, "eng");
    const amounts = [...text.matchAll(/\$?\s?(\d{1,4}[.,]\d{2})\b/g)].map((m) =>
      parseFloat(m[1].replace(",", "."))
    );
    const total = amounts.length ? Math.max(...amounts) : 0;
    const dateMatch = text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
    let date = "";
    if (dateMatch) {
      const parts = dateMatch[1].split(/[\/\-]/);
      if (parts[2] && parts[2].length === 4) {
        date = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      }
    }
    const firstLine = text.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "Unknown";
    return {
      vendor: firstLine,
      date: date || new Date().toISOString().slice(0, 10),
      total,
      category: "Uncategorized",
      items: [],
    };
  }

  EIQ.ocr = { localExtract };
})();
