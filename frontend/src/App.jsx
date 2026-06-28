import { useState } from 'react';
import { Container, Typography, TextField, Button, Card, CardContent, CircularProgress, MenuItem, Select, FormControl, InputLabel, ToggleButton, ToggleButtonGroup } from '@mui/material';

function App() {
  const [amount, setAmount] = useState(1000);
  const [targetCurrency, setTargetCurrency] = useState("INR"); 
  const [transferSpeed, setTransferSpeed] = useState("STANDARD");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:8080/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          fromCurrency: "AED",
          toCurrency: targetCurrency,
          method: transferSpeed 
        }),
      });

      if (!response.ok) throw new Error("Server threw an error!");

      const data = await response.json();
      setResults(data);
      
    } catch (error) {
      console.error("Connection failed:", error);
      alert("Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" style={{ marginTop: '40px', fontFamily: 'sans-serif' }}>
      
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Send Money Home
      </Typography>
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Compare live multi-currency rates & delivery speeds
      </Typography>

      <TextField 
        label="Amount in AED" 
        type="number" 
        fullWidth 
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        margin="normal"
      />

      <FormControl fullWidth margin="normal">
        <InputLabel>Destination Currency</InputLabel>
        <Select
          value={targetCurrency}
          label="Destination Currency"
          onChange={(e) => setTargetCurrency(e.target.value)}
        >
          <MenuItem value="INR">India (INR)</MenuItem>
          <MenuItem value="PKR">Pakistan (PKR)</MenuItem>
          <MenuItem value="PHP">Philippines (PHP)</MenuItem>
        </Select>
      </FormControl>

    
      <Typography variant="subtitle2" style={{ marginTop: '15px', marginBottom: '5px', fontWeight: 'bold' }}>
        Transfer Speed
      </Typography>
      <ToggleButtonGroup
        value={transferSpeed}
        exclusive
        fullWidth
        color="primary"
        onChange={(e, newSpeed) => { if (newSpeed) setTransferSpeed(newSpeed); }}
        style={{ marginBottom: '10px' }}
      >
        <ToggleButton value="STANDARD" style={{ padding: '10px' }}>Standard (Lower Fee)</ToggleButton>
        <ToggleButton value="EXPRESS" style={{ padding: '10px' }}>⚡ Express (Instant)</ToggleButton>
      </ToggleButtonGroup>

      <Button 
        variant="contained" 
        color="primary" 
        size="large"
        fullWidth 
        onClick={handleCompare}
        disabled={loading}
        style={{ marginTop: '15px', marginBottom: '30px', padding: '15px' }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Compare Best Rates"}
      </Button>

      {results && !loading && (
        <div>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Top Providers Today</Typography>
          
          <div style={{ backgroundColor: '#e8f5e9', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #c8e6c9' }}>
            <Typography variant="h6" color="success.main" fontWeight="bold">🏆 Best Deal: {results.bestProvider}</Typography>
            <Typography variant="body1" color="success.dark">
              You save <strong>{results.maxSavings} {results.currency}</strong> by choosing them!
            </Typography>
          </div>

          {results.quotes.map((quote) => (
            <Card key={quote.provider} style={{ marginBottom: '15px', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="h5" color="primary" fontWeight="bold">{quote.provider}</Typography>
                <Typography variant="body1" style={{ marginTop: '10px' }}>Exchange Rate: <strong>{quote.rate}</strong></Typography>
                <Typography variant="body2" color="textSecondary">Transfer Fee: {quote.fee} AED</Typography>
                <Typography variant="h6" color="success.main" style={{ marginTop: '15px', fontWeight: 'bold' }}>
                  Receiver Gets: {quote.receiveAmount} {results.currency}
                </Typography>
                <Typography variant="caption" color="textSecondary">Money arrives in {quote.deliveryHours} hour(s)</Typography>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </Container>
  );
}

export default App;