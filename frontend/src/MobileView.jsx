import { useEffect, useRef } from 'react';
import {
  Typography, TextField, Button, Card, CardContent, CircularProgress,
  MenuItem, Select, FormControl, Box, AppBar, Toolbar, IconButton, Alert,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LANGUAGES } from './translations';
import { fmt, fmtDate, feeLabel } from './format';

// Phone layout (< 600px). Same state, handlers and backend results as the
// desktop layout in App.jsx — only the arrangement differs:
//   - results come straight after the calculator (About moves to the bottom)
//   - the page scrolls to the results when they arrive
//   - compact provider rows instead of the 3x2 card grid
export default function MobileView({
  t, c, lang, setLang, mode, toggleMode,
  amount, setAmount, targetCurrency, setTargetCurrency,
  results, loading, error, amountInvalid, onCompare,
}) {
  const resultsRef = useRef(null);

  // Bring the results (or loading/error state) into view after Compare is
  // pressed, since on a phone they sit below the calculator.
  useEffect(() => {
    if ((loading || results || error) && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, results, error]);

  const cardSx = {
    width: '100%',
    borderRadius: '20px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
    border: `1px solid ${c.cardBorder}`,
    backgroundColor: c.cardBg,
  };
  const fieldSx = { backgroundColor: c.innerBg, p: 1.5, borderRadius: '14px', border: `1px solid ${c.innerBorder}`, mb: 2 };
  const labelSx = { color: c.textSecondary, fontWeight: 600, textTransform: 'uppercase' };
  const currentLang = LANGUAGES.find((l) => l.code === lang);

  return (
    <Box dir={t.dir} sx={{ backgroundColor: c.appBg, minHeight: '100vh', fontFamily: 'Inter, sans-serif', width: '100%', transition: 'background-color 0.3s ease' }}>

      {/* --- NAVIGATION BAR (sticky, compact) --- */}
      <AppBar position="sticky" elevation={0} sx={{ backgroundColor: c.barBg, borderBottom: `1px solid ${c.barBorder}` }}>
        <Toolbar sx={{ justifyContent: 'space-between', gap: 1, minHeight: '56px !important', px: 2 }}>
          <Typography sx={{ color: c.textPrimary, fontWeight: 800, letterSpacing: '-0.5px', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
            🌍 {t.appName}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Language selector: shows just the flag + code to save space;
                the menu still lists full language names. */}
            <FormControl size="small" variant="standard">
              <Select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disableUnderline
                renderValue={() => `${currentLang?.flag ?? ''} ${lang.toUpperCase()}`}
                inputProps={{ 'aria-label': 'language' }}
                sx={{
                  color: c.textPrimary,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  '& .MuiSelect-select': { py: 0.5 },
                  '& .MuiSvgIcon-root': { color: c.textSecondary },
                }}
              >
                {LANGUAGES.map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.flag}&nbsp;{l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <IconButton
              onClick={toggleMode}
              aria-label="toggle dark mode"
              sx={{ border: `1px solid ${c.barBorder}`, borderRadius: '12px', color: c.textPrimary, fontSize: '1rem', width: 40, height: 40 }}
            >
              {mode === 'light' ? '🌙' : '☀️'}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, pt: 3, pb: 6 }}>

        {/* --- HERO (compact) --- */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography component="h1" sx={{ fontWeight: 800, color: c.textPrimary, letterSpacing: '-0.5px', fontSize: '1.9rem', lineHeight: 1.15, mb: 1 }}>
            {t.heroTitle}
          </Typography>
          <Typography sx={{ color: c.textSecondary, fontSize: '0.95rem' }}>
            {t.heroSubtitle}
          </Typography>
        </Box>

        {/* --- CALCULATOR --- */}
        <Card sx={cardSx}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography sx={{ fontWeight: 700, color: c.textPrimary, mb: 2, fontSize: '1.1rem' }}>
              {t.calcTitle}
            </Typography>

            <Box sx={fieldSx}>
              <Typography variant="caption" sx={labelSx}>{t.youSend}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Typography sx={{ fontWeight: 700, color: c.textPrimary, mr: 1, fontSize: '1.4rem' }}>AED</Typography>
                <TextField
                  variant="standard"
                  type="number"
                  fullWidth
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  slotProps={{
                    htmlInput: { inputMode: 'decimal', 'aria-label': t.youSend },
                    input: { disableUnderline: true, sx: { fontSize: '1.4rem', fontWeight: 700, color: c.textPrimary } },
                  }}
                  sx={{
                    '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                    '& input[type=number]': { MozAppearance: 'textfield' },
                  }}
                />
              </Box>
            </Box>

            <Box sx={fieldSx}>
              <Typography variant="caption" sx={labelSx}>{t.recipientGets}</Typography>
              <FormControl fullWidth variant="standard" sx={{ mt: 0.5, minWidth: 0 }}>
                <Select
                  value={targetCurrency}
                  onChange={(e) => setTargetCurrency(e.target.value)}
                  disableUnderline
                  inputProps={{ 'aria-label': t.recipientGets }}
                  sx={{
                    width: '100%', fontSize: '1.25rem', fontWeight: 700, color: c.textPrimary,
                    '& .MuiSelect-select': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                  }}
                >
                  <MenuItem value="EUR">{t.currencies.EUR}</MenuItem>
                  <MenuItem value="INR">{t.currencies.INR}</MenuItem>
                  <MenuItem value="PKR">{t.currencies.PKR}</MenuItem>
                  <MenuItem value="PHP">{t.currencies.PHP}</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={onCompare}
              disabled={loading || amountInvalid}
              sx={{
                py: 1.75,
                borderRadius: '14px',
                backgroundColor: c.accent,
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                '&:hover': { backgroundColor: c.accentHover },
                '&.Mui-disabled': { backgroundColor: c.accent, opacity: 0.5, color: 'white' },
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : t.compareRates}
            </Button>
          </CardContent>
        </Card>

        {/* --- RESULTS (directly under the calculator) --- */}
        <Box ref={resultsRef} sx={{ mt: 3, scrollMarginTop: '72px' }}>
          {loading && (
            <Box sx={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${c.dashedBorder}`, borderRadius: '20px' }}>
              <CircularProgress sx={{ color: c.accent }} />
            </Box>
          )}

          {!loading && error && (
            <Box sx={{ minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, textAlign: 'center', p: 3, border: `2px solid ${c.innerBorder}`, borderRadius: '20px', backgroundColor: c.cardBg }}>
              <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>⚠️</Typography>
              <Typography sx={{ color: c.textPrimary, fontWeight: 700 }}>{error}</Typography>
              <Button
                variant="outlined"
                onClick={onCompare}
                sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, color: c.accent, borderColor: c.accent, '&:hover': { borderColor: c.accentHover } }}
              >
                {t.retry}
              </Button>
            </Box>
          )}

          {!results && !loading && !error && (
            <Box sx={{ py: 4, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${c.dashedBorder}`, borderRadius: '20px' }}>
              <Typography sx={{ color: c.textMuted, fontWeight: 600, textAlign: 'center' }}>{t.emptyState}</Typography>
            </Box>
          )}

          {results && !loading && !error && (
            <Box>
              {/* Winner banner */}
              <Card sx={{ backgroundColor: c.success, color: 'white', borderRadius: '16px', mb: 3, boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
                <CardContent sx={{ p: '16px 20px !important' }}>
                  <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: '1px', opacity: 0.9, lineHeight: 1.6 }}>{t.bestOverall}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.25 }}>
                    {fmt(t.useProvider, { provider: results.bestProvider })}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>{t.youSave}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>+{results.maxSavings} {results.currency}</Typography>
                  </Box>
                </CardContent>
              </Card>

              <Typography sx={{ fontWeight: 700, color: c.textPrimary, fontSize: '1.15rem', mb: 0.5 }}>{t.providerQuotes}</Typography>
              <Typography variant="caption" sx={{ color: c.textMuted, display: 'block', mb: 1.5 }}>{t.estimatedNote}</Typography>
              {results.rateLive === false && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>{t.rateNotLive}</Alert>
              )}

              {/* Compact provider rows */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 3 }}>
                {results.quotes.map((quote) => {
                  const isBest = quote.provider === results.bestProvider;
                  return (
                    <Card key={quote.provider} sx={{
                      borderRadius: '14px',
                      border: `1px solid ${isBest ? c.success : c.innerBorder}`,
                      boxShadow: 'none',
                      backgroundColor: c.cardBg,
                    }}>
                      <CardContent sx={{ p: '12px 14px !important' }}>
                        {/* Name (wraps, never truncated) + amount received */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                          <Typography
                            component="a"
                            href={quote.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontWeight: 800, color: c.textPrimary, fontSize: '1rem', lineHeight: 1.3, textDecoration: 'none', minWidth: 0, '&:active': { textDecoration: 'underline' } }}
                          >
                            {quote.provider}
                          </Typography>
                          <Box sx={{ flexShrink: 0, textAlign: 'end' }}>
                            <Typography component="span" sx={{ fontWeight: 800, fontSize: '1.15rem', color: isBest ? c.success : c.textPrimary }}>
                              {quote.receiveAmount.toLocaleString()}
                            </Typography>
                            <Typography component="span" sx={{ color: c.textSecondary, fontWeight: 700, fontSize: '0.8rem' }}>
                              {' '}{results.currency}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Rate + fee */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: c.textSecondary }}>
                            <Box component="span" sx={{ color: c.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>{t.rate}</Box>{' '}
                            <Box component="span" sx={{ fontWeight: 700, color: c.textPrimary }}>{quote.rate}</Box>
                          </Typography>
                          <Typography variant="caption" sx={{ color: c.textSecondary, textAlign: 'end' }}>
                            {t.fee}: {feeLabel(quote, t, results.sendCurrency)}
                          </Typography>
                        </Box>

                        {quote.feeType === 'varies' && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: c.warning, fontSize: '0.7rem' }}>
                            ⚠ {t.feeVariesWarning}
                          </Typography>
                        )}

                        {quote.estimated && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: c.textMuted, fontSize: '0.68rem' }}>
                            ⚠ {t.estimatedShort}
                            {quote.lastVerified ? ` · ${fmt(t.verified, { date: fmtDate(quote.lastVerified, lang) })}` : ''}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>

              {/* Trend chart — only when real history exists (see App.jsx). */}
              <Card sx={{ borderRadius: '20px', border: `1px solid ${c.innerBorder}`, boxShadow: 'none', backgroundColor: c.cardBg }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography sx={{ fontWeight: 700, color: c.textPrimary, mb: 2, fontSize: '1.05rem' }}>
                    {t.marketTrend}
                  </Typography>
                  {results.trendAvailable && results.trend && results.trend.length > 1 ? (
                    <Box sx={{ width: '100%', height: 180 }} dir="ltr">
                      <ResponsiveContainer>
                        <LineChart data={results.trend} margin={{ top: 5, right: 8, bottom: 5, left: -20 }}>
                          <Line type="monotone" dataKey="rate" stroke={c.accent} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: c.accent }} />
                          <CartesianGrid stroke={c.chartGrid} vertical={false} />
                          <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} stroke={c.textMuted} dy={8} interval="preserveStartEnd" />
                          <YAxis domain={['auto', 'auto']} fontSize={11} tickLine={false} axisLine={false} stroke={c.textMuted} dx={-6} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 600, backgroundColor: c.tooltipBg, color: c.tooltipText }}
                            itemStyle={{ color: c.accent }}
                            labelStyle={{ color: c.tooltipText }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>📉</Typography>
                      <Typography variant="body2" sx={{ color: c.textMuted, fontWeight: 600 }}>
                        {t.trendUnavailable}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>

        {/* --- ABOUT (moved to the bottom on phones) --- */}
        <Card sx={{ ...cardSx, mt: 3 }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography sx={{ fontWeight: 800, color: c.textPrimary, mb: 1.5, letterSpacing: '-0.5px', fontSize: '1.1rem' }}>
              {t.aboutTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: c.textBody, lineHeight: 1.7 }}>
              {t.aboutBody}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
