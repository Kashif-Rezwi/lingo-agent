import { useState, useEffect } from 'react';
import { Rocket, Server, Layout, Github, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import api from './lib/api';

function App() {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [uptime, setUptime] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await api.get('/health');
        if (response.data.status === 'ok') {
          setServerStatus('online');
          setUptime(Math.floor(response.data.uptime) + 's');
        }
      } catch (err) {
        setServerStatus('offline');
      }
    };
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl w-full"
      >
        <header className="mb-12 text-center">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 5 }}
            className="inline-block mb-4"
          >
            <Rocket size={64} className="text-blue-500" />
          </motion.div>
          <h1 className="text-6xl font-extrabold mb-4 tracking-tight">
            Hackathon <span className="hero-gradient">Starter</span>
          </h1>
          <p className="text-xl opacity-60">
            A premium React + NestJS template for rapid development.
          </p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          {/* Server Info Card */}
          <div className="glass-card p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <Server className="text-blue-400" />
              <h2 className="text-xl font-semibold">Backend Status</h2>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${serverStatus === 'online' ? 'bg-green-500' :
                  serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
              <span className="capitalize">{serverStatus}</span>
            </div>
            {uptime && <p className="text-sm opacity-50">Uptime: {uptime}</p>}
            <p className="mt-4 text-sm opacity-70">
              NestJS server is pre-configured with Swagger, Validation, and CORS.
            </p>
          </div>

          {/* Frontend Info Card */}
          <div className="glass-card p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <Layout className="text-purple-400" />
              <h2 className="text-xl font-semibold">Frontend Tools</h2>
            </div>
            <ul className="text-sm space-y-2 opacity-70">
              <li>• React 18 + Vite</li>
              <li>• Framer Motion for animations</li>
              <li>• Lucide React for icons</li>
              <li>• Axios pre-configured for /api</li>
            </ul>
          </div>
        </main>

        <footer className="mt-16 flex justify-center gap-6">
          <button className="flex items-center gap-2">
            <Github size={20} />
            Source Code
          </button>
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700">
            Learn More
            <ExternalLink size={20} />
          </button>
        </footer>
      </motion.div>
    </div>
  );
}

export default App;
