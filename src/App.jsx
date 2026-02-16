import React, { useState, useEffect, useRef } from 'react';
import { FaPowerOff, FaTerminal, FaNetworkWired, FaShieldAlt, FaRocket } from 'react-icons/fa';
import { FiX, FiList, FiSave } from "react-icons/fi"; 
import './App.css'; 

const { ipcRenderer } = window.require('electron');

function App() {
  const [logs, setLogs] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState(() => localStorage.getItem('nexus-link') || "");
  const [autoStart, setAutoStart] = useState(() => localStorage.getItem('nexus-autostart') === 'true');
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [showSavedList, setShowSavedList] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [serverName, setServerName] = useState("");
  const logEndRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('nexus-configs');
    if (saved) setSavedConfigs(JSON.parse(saved));
    ipcRenderer.on('xray-log', (event, message) => {
      const cleanLog = message.replace(/\[\d+m/g, '') + "\n";
      setLogs(prev => (prev + cleanLog).slice(-5000));
      if (message.includes('ACTIVE')) setIsRunning(true); // ✅ Metric Logic එකට මැච් කළා
      if (message.includes('Disconnected')) setIsRunning(false);
    });
    return () => { ipcRenderer.removeAllListeners('xray-log'); };
  }, []);

  useEffect(() => { localStorage.setItem('nexus-link', config); }, [config]);
  useEffect(() => { 
    localStorage.setItem('nexus-autostart', String(autoStart));
    ipcRenderer.send('toggle-startup', autoStart);
  }, [autoStart]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const handleToggle = () => {
    if (isRunning) { ipcRenderer.send('stop-tunnel'); } 
    else {
      if (!config) return setLogs(p => p + ">> ERROR: Paste Link First!\n");
      setLogs(">> Initializing...\n"); 
      ipcRenderer.send('start-tunnel', config);
    }
  };

  const handleSaveConfig = () => {
    if (serverName && config) {
      const newConfig = { id: Date.now(), name: serverName, link: config };
      const updated = [...savedConfigs, newConfig];
      setSavedConfigs(updated);
      localStorage.setItem('nexus-configs', JSON.stringify(updated));
      setShowSaveModal(false);
      setServerName("");
    }
  };

  const deleteConfig = (id) => {
    const updated = savedConfigs.filter(c => c.id !== id);
    setSavedConfigs(updated);
    localStorage.setItem('nexus-configs', JSON.stringify(updated));
  };

  const loadConfig = (link) => { setConfig(link); setShowSavedList(false); setLogs(p => p + ">> Config Loaded.\n"); };

  return (
    <div className="app-container">
      <div className="header drag-region">
        <div className="brand"><FaShieldAlt size={22} className="logo-icon" /><h1>TEAM ROA <span className="highlight">NET</span></h1></div>
        <div className="window-controls no-drag">
          <div onClick={() => ipcRenderer.send('minimize-app')} className="control-btn min-btn"></div>
          <div onClick={() => ipcRenderer.send('close-app')} className="control-btn close-btn"></div>
        </div>
      </div>
      <div className="main-content">
        <div className={`status-badge no-drag ${isRunning ? 'active' : ''}`}>
          <div className="dot"></div>{isRunning ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
        <div className="connection-wrapper no-drag">
          <div className={`power-ring ${isRunning ? 'glow' : ''}`}>
            <button className={`power-btn ${isRunning ? 'running' : ''}`} onClick={handleToggle}><FaPowerOff /></button>
          </div>
        </div>
        <div className="features-bar no-drag">
           <button className={`feature-btn startup ${autoStart ? 'active' : ''}`} onClick={() => setAutoStart(!autoStart)}><FaRocket /> <span>STARTUP</span></button>
        </div>
        <div className="input-group no-drag">
          <div className="input-wrapper"><FaNetworkWired className="input-icon" /><input type="text" placeholder="Paste VLESS Link..." value={config} onChange={(e) => setConfig(e.target.value)} disabled={isRunning}/></div>
          <button className="action-btn" onClick={() => setShowSaveModal(true)} title="Save"><FiSave /></button>
          <button className="action-btn" onClick={() => setShowSavedList(true)} title="List"><FiList /></button>
        </div>
        <div className="terminal-window no-drag">
          <div className="terminal-header"><FaTerminal /> <span>SYSTEM LOGS</span></div>
          <div className="terminal-body"><pre>{logs || "Ready..."}</pre><div ref={logEndRef} /></div>
        </div>
      </div>
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Save Configuration</h3>
            <input type="text" placeholder="Server Name" value={serverName} onChange={(e) => setServerName(e.target.value)} />
            <div className="modal-actions"><button onClick={() => setShowSaveModal(false)}>Cancel</button><button className="confirm" onClick={handleSaveConfig}>Save</button></div>
          </div>
        </div>
      )}
      {showSavedList && (
        <div className="modal-overlay">
          <div className="modal list-modal">
            <h3>Saved Servers</h3>
            <div className="server-list">
              {savedConfigs.length === 0 ? <p>No saved servers</p> : savedConfigs.map(item => (
                <div key={item.id} className="server-item"><span onClick={() => loadConfig(item.link)}>{item.name}</span><FiX className="delete-icon" onClick={() => deleteConfig(item.id)} /></div>
              ))}
            </div>
            <button className="close-list" onClick={() => setShowSavedList(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;