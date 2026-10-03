// Shared display helpers for the desktop (App.jsx) and mobile (MobileView.jsx) layouts.

// Replace {token} placeholders in a translation string, e.g. fmt("in {h}h", {h: 24}).
export const fmt = (str, vars = {}) =>
  str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));

// Format an ISO date (YYYY-MM-DD) for display in the active language.
export const fmtDate = (iso, lang) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(lang, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

// The fee text shown on a provider card, from the backend's feeType.
export const feeLabel = (quote, t, sendCurrency) => {
  if (quote.feeType === 'fixed') return `${quote.fee} ${sendCurrency || 'AED'}`;
  if (quote.feeType === 'included') return t.feeIncluded;
  if (quote.feeType === 'varies') return t.feeVaries;
  return t.checkProvider;
};
