import { useState, useEffect, useMemo } from 'react';
import {
  Container, Typography, TextField, Button, Card, CardContent,
  CircularProgress, MenuItem, Select, FormControl, Box, Chip,
  AppBar, Toolbar, ToggleButton, ToggleButtonGroup, IconButton,
  ThemeProvider, createTheme, CssBaseline
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { translations, LANGUAGES } from './translations';

// Backend base URL comes from the environment (see .env / .env.example) so the
// same build works in dev and production. Falls back to local dev.
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Replace {token} placeholders in a translation string, e.g. fmt("in {h}h", {h: 24}).
const fmt = (str, vars = {}) =>
  str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));

// Colour tokens for each mode. Every custom colour used in the UI lives here so the
// whole app re-themes by flipping `mode`.
const getColors = (mode) => {
  const light = {
    appBg: '#f8fafc',
    barBg: '#ffffff',
    barBorder: '#e2e8f0',
    cardBg: '#ffffff',
    cardBorder: '#f1f5f9',
    innerBg: '#f8fafc',
    innerBorder: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    textBody: '#475569',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    accentBg: '#e0e7ff',
    success: '#10b981',
    chipBg: '#f1f5f9',
    chipText: '#475569',
    dashedBorder: '#cbd5e1',
    chartGrid: '#f1f5f9',
    tooltipBg: '#ffffff',
    tooltipText: '#0f172a',
  };
  const dark = {
    appBg: '#0b1120',
    barBg: '#111827',
    barBorder: '#1f2937',
    cardBg: '#111827',
    cardBorder: '#1f2937',
    innerBg: '#0b1120',
    innerBorder: '#1f2937',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textBody: '#cbd5e1',
    accent: '#818cf8',
    accentHover: '#6366f1',
    accentBg: '#312e81',
    success: '#34d399',
    chipBg: '#1f2937',
    chipText: '#cbd5e1',
    dashedBorder: '#334155',
    chartGrid: '#1f2937',
    tooltipBg: '#1e293b',
    tooltipText: '#f1f5f9',
  };
  return mode === 'dark' ? dark : light;
};

function App() {
  const [amount, setAmount] = useState(1000);
  const [targetCurrency, setTargetCurrency] = useState("EUR");
  const [transferSpeed, setTransferSpeed] = useState("STANDARD");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Theme + language state (persisted across visits) ---
  // On first visit fall back to the OS colour-scheme preference; after that, the
  // user's saved choice wins.
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('gr_mode');
    if (saved) return saved;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });
  const [lang, setLang] = useState(() => localStorage.getItem('gr_lang') || 'en');

  const t = translations[lang] || translations.en;
  const c = useMemo(() => getColors(mode), [mode]);

  // MUI theme so built-in components (menus, inputs) also follow the mode + direction.
  const theme = useMemo(
    () => createTheme({
      palette: {
        mode,
        primary: { main: c.accent },
        background: { default: c.appBg, paper: c.cardBg },
      },
      direction: t.dir,
      typography: { fontFamily: 'Inter, sans-serif' },
    }),
    [mode, c, t.dir]
  );

  // Persist choices and apply document-level direction/lang for RTL languages.
  useEffect(() => {
    localStorage.setItem('gr_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('gr_lang', lang);
    document.documentElement.setAttribute('dir', t.dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang, t.dir]);

  const toggleMode = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          fromCurrency: "AED",
          toCurrency: targetCurrency,
          method: transferSpeed
        }),
      });

      if (!response.ok) throw new Error(t.serverError);
      const data = await response.json();
      setResults(data);

    } catch (err) {
      console.error("Connection failed:", err);
      setResults(null);
      setError(t.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const amountInvalid = !(Number(amount) > 0);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box dir={t.dir} sx={{ backgroundColor: c.appBg, minHeight: '100vh', fontFamily: 'Inter, sans-serif', width: '100%', transition: 'background-color 0.3s ease' }}>

        {/* --- NAVIGATION BAR --- */}
        <AppBar position="static" elevation={0} sx={{ backgroundColor: c.barBg, borderBottom: `1px solid ${c.barBorder}` }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="h6" sx={{ color: c.textPrimary, fontWeight: 800, letterSpacing: '-0.5px' }}>
              🌍 {t.appName}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip label={t.liveRates} size="small" sx={{ backgroundColor: c.accentBg, color: c.accent, fontWeight: 600, display: { xs: 'none', sm: 'flex' } }} />

              {/* Language selector */}
              <FormControl size="small" variant="standard">
                <Select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  disableUnderline
                  sx={{
                    color: c.textPrimary,
                    fontWeight: 600,
                    '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5 },
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

              {/* Dark-mode toggle */}
              <IconButton
                onClick={toggleMode}
                aria-label="toggle dark mode"
                sx={{
                  border: `1px solid ${c.barBorder}`,
                  borderRadius: '12px',
                  color: c.textPrimary,
                  fontSize: '1.1rem',
                  width: 40, height: 40,
                }}
              >
                {mode === 'light' ? '🌙' : '☀️'}
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* --- MAIN FULL-WIDTH CONTAINER --- */}
        <Container maxWidth={false} sx={{ pt: 6, pb: 10, px: { xs: 3, md: 8, lg: 12 } }}>

          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: c.textPrimary, letterSpacing: '-1px', mb: 1 }}>
              {t.heroTitle}
            </Typography>
            <Typography variant="h6" sx={{ color: c.textSecondary, fontWeight: 400 }}>
              {t.heroSubtitle}
            </Typography>
          </Box>

          {/* Outer Split: Left Column vs Right Column */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 8fr' }, gap: { xs: 4, md: 6 }, alignItems: 'start', width: '100%' }}>

            {/* --- LEFT COLUMN --- */}
            <Box sx={{ minWidth: 0, width: '100%' }}>

              {/* 1. CALCULATOR CARD */}
              <Card sx={{
                width: '100%',
                borderRadius: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                overflow: 'hidden',
                border: `1px solid ${c.cardBorder}`,
                backgroundColor: c.cardBg,
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, mb: 3 }}>
                    {t.calcTitle}
                  </Typography>

                  <Box sx={{ backgroundColor: c.innerBg, p: 2, borderRadius: '16px', border: `1px solid ${c.innerBorder}`, mb: 3 }}>
                    <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>{t.youSend}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary, mr: 1 }}>AED</Typography>

                      <TextField
                        variant="standard"
                        type="number"
                        fullWidth
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        sx={{
                          '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                            WebkitAppearance: 'none',
                            display: 'none',
                            margin: 0,
                          },
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                        }}
                        InputProps={{
                          disableUnderline: true,
                          sx: {
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: c.textPrimary
                          }
                        }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ backgroundColor: c.innerBg, p: 2, borderRadius: '16px', border: `1px solid ${c.innerBorder}`, mb: 3 }}>
                    <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>{t.recipientGets}</Typography>
                    <FormControl fullWidth variant="standard" sx={{ mt: 1, minWidth: 0 }}>
                      <Select
                        value={targetCurrency}
                        onChange={(e) => setTargetCurrency(e.target.value)}
                        disableUnderline
                        sx={{
                          width: '100%',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: c.textPrimary,
                          '& .MuiSelect-select': {
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            paddingRight: '24px'
                          }
                        }}
                      >
                        <MenuItem value="EUR">{t.currencies.EUR}</MenuItem>
                        <MenuItem value="INR">{t.currencies.INR}</MenuItem>
                        <MenuItem value="PKR">{t.currencies.PKR}</MenuItem>
                        <MenuItem value="PHP">{t.currencies.PHP}</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600, textTransform: 'uppercase', mb: 1, display: 'block' }}>{t.transferSpeed}</Typography>
                  <ToggleButtonGroup
                    value={transferSpeed}
                    exclusive
                    fullWidth
                    onChange={(e, newSpeed) => { if (newSpeed) setTransferSpeed(newSpeed); }}
                    sx={{
                      mb: 4,
                      '& .MuiToggleButton-root': { borderRadius: '12px', textTransform: 'none', fontWeight: 600, border: `1px solid ${c.innerBorder}`, py: 1.5, color: c.textSecondary },
                      '& .Mui-selected': { backgroundColor: `${c.accentBg} !important`, color: `${c.accent} !important`, border: `1px solid ${c.accent} !important` }
                    }}
                  >
                    <ToggleButton value="STANDARD">{t.standard}</ToggleButton>
                    <ToggleButton value="EXPRESS">{t.express}</ToggleButton>
                  </ToggleButtonGroup>

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleCompare}
                    disabled={loading || amountInvalid}
                    sx={{
                      py: 2,
                      borderRadius: '16px',
                      backgroundColor: c.accent,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                      '&:hover': { backgroundColor: c.accentHover },
                      '&.Mui-disabled': { backgroundColor: c.accent, opacity: 0.5, color: 'white' }
                    }}
                  >
                    {loading ? <CircularProgress size={26} sx={{ color: 'white' }} /> : t.compareRates}
                  </Button>
                </CardContent>
              </Card>

              {/* 2. ABOUT THE DEVELOPER CARD */}
              <Card sx={{
                width: '100%',
                mt: 4,
                borderRadius: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                border: `1px solid ${c.cardBorder}`,
                backgroundColor: c.cardBg
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: c.textPrimary, mb: 2, letterSpacing: '-0.5px' }}>
                    {t.aboutTitle}
                  </Typography>
                  <Typography variant="body1" sx={{ color: c.textBody, lineHeight: 1.7 }}>
                    {t.aboutBody}
                  </Typography>
                </CardContent>
              </Card>

            </Box>

            {/* --- RIGHT COLUMN: RESULTS & GRAPH --- */}
            <Box sx={{ minWidth: 0, width: '100%' }}>
              {/* Loading placeholder */}
              {loading && (
                <Box sx={{ width: '100%', minHeight: '430px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: `2px dashed ${c.dashedBorder}`, borderRadius: '24px' }}>
                  <CircularProgress sx={{ color: c.accent }} />
                </Box>
              )}

              {/* Error state (replaces the alert popup) */}
              {!loading && error && (
                <Box sx={{ width: '100%', minHeight: '430px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center', px: 3, border: `2px solid ${c.innerBorder}`, borderRadius: '24px', backgroundColor: c.cardBg }}>
                  <Typography variant="h2" sx={{ lineHeight: 1 }}>⚠️</Typography>
                  <Typography variant="h6" sx={{ color: c.textPrimary, fontWeight: 700 }}>{error}</Typography>
                  <Button
                    variant="outlined"
                    onClick={handleCompare}
                    sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, color: c.accent, borderColor: c.accent, '&:hover': { borderColor: c.accentHover } }}
                  >
                    {t.retry}
                  </Button>
                </Box>
              )}

              {/* Empty state */}
              {!results && !loading && !error && (
                <Box sx={{ width: '100%', height: '100%', minHeight: '430px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${c.dashedBorder}`, borderRadius: '24px' }}>
                  <Typography variant="h6" sx={{ color: c.textMuted, fontWeight: 600, textAlign: 'center', px: 3 }}>{t.emptyState}</Typography>
                </Box>
              )}

              {results && !loading && !error && (
                <Box sx={{ width: '100%' }}>
                  {/* Winner Banner */}
                  <Card sx={{ backgroundColor: c.success, color: 'white', borderRadius: '16px', mb: 4, boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '24px !important' }}>
                      <Box>
                        <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: '1px', opacity: 0.9 }}>{t.bestOverall}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>{fmt(t.useProvider, { provider: results.bestProvider })}</Typography>
                      </Box>
                      <Box sx={{ textAlign: t.dir === 'rtl' ? 'left' : 'right' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>{t.youSave}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>+{results.maxSavings} {results.currency}</Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, mb: 0.5 }}>{t.providerQuotes}</Typography>
                  <Typography variant="caption" sx={{ color: c.textMuted, display: 'block', mb: 2 }}>{t.estimatedNote}</Typography>

                  {/* --- HARD-LOCKED 3x2 CSS GRID --- */}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                    gap: 2,
                    width: '100%',
                    mb: 4
                  }}>
                    {results.quotes.map((quote) => (
                      <Card key={quote.provider} sx={{
                        borderRadius: '16px',
                        border: `1px solid ${c.innerBorder}`,
                        boxShadow: 'none',
                        backgroundColor: c.cardBg,
                        height: '100%',
                        width: '100%',
                        minWidth: 0,
                        transition: 'transform 0.2s, border-color 0.2s',
                        '&:hover': { borderColor: c.textMuted, transform: 'translateY(-2px)' }
                      }}>
                        <CardContent sx={{
                          padding: '16px !important',
                          paddingBottom: '16px !important',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          height: '100%',
                          boxSizing: 'border-box'
                        }}>

                          {/* Top Section */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            {/* Left: Name and Speed */}
                            <Box sx={{ minWidth: 0, pr: 1 }}>
                              <Typography
                                component="a"
                                href={quote.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="h6"
                                sx={{
                                  fontWeight: 800,
                                  color: c.textPrimary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.2,
                                  textDecoration: 'none',
                                  display: 'block',
                                  '&:hover': { textDecoration: 'underline', color: c.textPrimary }
                                }}
                              >
                                {quote.provider}
                              </Typography>
                              <Chip label={fmt(t.inHours, { h: quote.deliveryHours })} size="small" sx={{ mt: 0.5, backgroundColor: c.chipBg, color: c.chipText, fontWeight: 600, height: '20px', fontSize: '0.7rem' }} />
                            </Box>

                            {/* Right: Rate and Fee */}
                            <Box sx={{ flexShrink: 0, textAlign: t.dir === 'rtl' ? 'left' : 'right' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: c.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>{t.rate}</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: c.textPrimary }}>{quote.rate}</Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block' }}>
                                {t.fee}: {quote.fee} {results.sendCurrency || 'AED'}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Bottom Section */}
                          <Box sx={{ pt: 1, mt: 1, borderTop: `1px dashed ${c.innerBorder}` }}>
                            <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                              {t.recipientGetsCard}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'nowrap', minWidth: 0 }}>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: quote.provider === results.bestProvider ? c.success : c.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {quote.receiveAmount.toLocaleString()}
                              </Typography>
                              <Typography variant="body2" sx={{ color: c.textSecondary, fontWeight: 700, flexShrink: 0 }}>
                                {results.currency}
                              </Typography>
                            </Box>
                          </Box>

                        </CardContent>
                      </Card>
                    ))}
                  </Box>

                  {/* Interactive Chart — only shown when the trend reflects real
                      market movement (backend sets trendAvailable=false for
                      currencies the live feed doesn't cover, e.g. PKR). */}
                  <Card sx={{ mt: 4, borderRadius: '24px', border: `1px solid ${c.innerBorder}`, boxShadow: 'none', backgroundColor: c.cardBg }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, mb: 3 }}>
                        {t.marketTrend}
                      </Typography>
                      {results.trendAvailable && results.trend && results.trend.length > 1 ? (
                        <Box sx={{ width: '100%', height: 220 }}>
                          <ResponsiveContainer>
                            <LineChart data={results.trend} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                              <Line type="monotone" dataKey="rate" stroke={c.accent} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: c.accent }} />
                              <CartesianGrid stroke={c.chartGrid} vertical={false} />
                              <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} stroke={c.textMuted} dy={10} />
                              <YAxis domain={['auto', 'auto']} fontSize={12} tickLine={false} axisLine={false} stroke={c.textMuted} dx={-10} />
                              <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 600, backgroundColor: c.tooltipBg, color: c.tooltipText }}
                                itemStyle={{ color: c.accent }}
                                labelStyle={{ color: c.tooltipText }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Box sx={{ width: '100%', height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, textAlign: 'center', px: 2 }}>
                          <Typography variant="h3" sx={{ lineHeight: 1 }}>📉</Typography>
                          <Typography variant="body2" sx={{ color: c.textMuted, fontWeight: 600, maxWidth: 360 }}>
                            {t.trendUnavailable}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
