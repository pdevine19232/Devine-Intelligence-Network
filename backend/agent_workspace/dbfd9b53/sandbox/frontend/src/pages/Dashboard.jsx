import { useState, useEffect, useCallback } from 'react';

const Dashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCoverageData();
  }, []);

  const fetchCoverageData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/coverage/companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch coverage data');
      const data = await response.json();
      setCompanies(data.companies || []);
      setSectors(data.sectors || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Coverage fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyClick = useCallback((company) => {
    setSelectedCompany(company);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCompany(null);
  }, []);

  const containerStyle = {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#faf9f6',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    color: '#1a1a18',
  };

  const headerStyle = {
    padding: '24px 32px',
    borderBottom: '1px solid #e8e4dc',
    backgroundColor: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const headerTitleStyle = {
    fontSize: '24px',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  };

  const statusBarStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const statusDotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#2a7a4a',
  };

  const statusTextStyle = {
    fontSize: '14px',
    color: '#1a1a18',
    fontFamily: '"Courier New", monospace',
  };

  const contentStyle = {
    flex: 1,
    overflow: 'auto',
    padding: '32px',
  };

  const loadingStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  };

  const errorStyle = {
    padding: '16px',
    backgroundColor: '#fef2f0',
    borderLeft: '3px solid #c0341a',
    borderRadius: '4px',
    color: '#c0341a',
    marginBottom: '24px',
  };

  const companiesGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  };

  const companyCardStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e8e4dc',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  const companyCardHoverStyle = {
    backgroundColor: '#fff',
    border: '1px solid #d0c8bc',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    transform: 'translateY(-2px)',
  };

  const companyTickerStyle = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '8px',
    fontFamily: '"Courier New", monospace',
    color: '#1a1a18',
  };

  const companyNameStyle = {
    fontSize: '14px',
    color: '#5a5850',
    marginBottom: '12px',
  };

  const companyMetricsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const companyPriceStyle = {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a18',
  };

  const companyChangeStyle = (changePercent) => ({
    fontSize: '14px',
    fontWeight: '500',
    color: changePercent >= 0 ? '#2a7a4a' : '#c0341a',
  });

  const [hoveredCompany, setHoveredCompany] = useState(null);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={headerTitleStyle}>Dashboard</div>
          <div style={statusBarStyle}>
            <div style={statusDotStyle}></div>
            <div style={statusTextStyle}>Agent System Online</div>
          </div>
        </div>
        <div style={loadingStyle}>
          <div style={{ fontSize: '16px', color: '#5a5850' }}>Loading coverage universe...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={headerTitleStyle}>Dashboard</div>
          <div style={statusBarStyle}>
            <div style={statusDotStyle}></div>
            <div style={statusTextStyle}>Agent System Online</div>
          </div>
        </div>
        <div style={contentStyle}>
          <div style={errorStyle}>{error}</div>
          <button
            onClick={fetchCoverageData}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4a7a5a',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerTitleStyle}>Dashboard</div>
        <div style={statusBarStyle}>
          <div style={statusDotStyle}></div>
          <div style={statusTextStyle}>Agent System Online</div>
        </div>
      </div>

      <div style={contentStyle}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Coverage Universe</h2>
          {companies.length === 0 ? (
            <div style={{ color: '#5a5850' }}>No companies in coverage universe yet.</div>
          ) : (
            <div style={companiesGridStyle}>
              {companies.map((company) => (
                <div
                  key={company.ticker}
                  style={hoveredCompany === company.ticker ? companyCardHoverStyle : companyCardStyle}
                  onClick={() => handleCompanyClick(company)}
                  onMouseEnter={() => setHoveredCompany(company.ticker)}
                  onMouseLeave={() => setHoveredCompany(null)}
                >
                  <div style={companyTickerStyle}>{company.ticker}</div>
                  <div style={companyNameStyle}>{company.name || 'Unknown'}</div>
                  <div style={companyMetricsStyle}>
                    <div style={companyPriceStyle}>${company.price || 'N/A'}</div>
                    <div style={companyChangeStyle(company.change_pct)}>
                      {company.change_pct >= 0 ? '▲' : '▼'} {Math.abs(company.change_pct || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;