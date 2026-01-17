import { useEffect, useState } from 'react';

const HealthCheck = () => {
  const [flaskStatus, setFlaskStatus] = useState('Checking...');
  const [expressStatus, setExpressStatus] = useState('Checking...');

  useEffect(() => {
    // Test Flask Proxy (/api/py/health -> localhost:5001/health)
    fetch('/api/py/health')
      .then(res => res.json())
      .then(data => setFlaskStatus(data.status === 'ok' ? '🟢 Flask Online' : '🔴 Flask Error'))
      .catch(() => setFlaskStatus('🔴 Flask Offline'));

    // Test Express Proxy (/api/js/health -> localhost:3001/health)
    fetch('/api/js/health')
      .then(res => res.json())
      .then(data => setExpressStatus(data.status === 'ok' ? '🟢 Express Online' : '🔴 Express Error'))
      .catch(() => setExpressStatus('🔴 Express Offline'));
  }, []);

  return (
    <div className="p-4 border rounded-lg bg-slate-900 text-white space-y-2">
      <h3 className="font-bold">Backend System Status</h3>
      <p>{flaskStatus}</p>
      <p>{expressStatus}</p>
    </div>
  );
};

export default HealthCheck;