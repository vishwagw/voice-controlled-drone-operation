import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Radio, AlertCircle } from 'lucide-react';

const DroneSimulator = () => {
  const [droneState, setDroneState] = useState({
    armed: false,
    flying: false,
    altitude: 0,
    propellerSpeed: 0
  });
  
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [logs, setLogs] = useState([]);
  const [recognition, setRecognition] = useState(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const propellerRotation = useRef(0);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        processCommand(transcript);
      };

      recognitionInstance.onerror = (event) => {
        addLog(`Speech recognition error: ${event.error}`, 'error');
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        if (isListening) {
          recognitionInstance.start();
        }
      };

      setRecognition(recognitionInstance);
    } else {
      addLog('Speech recognition not supported in this browser', 'error');
    }
  }, []);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), { message, type, timestamp }]);
  };

  const processCommand = (command) => {
    setLastCommand(command);
    addLog(`Command received: "${command}"`, 'command');

    if (command.includes('arm')) {
      armDrone();
    } else if (command.includes('take off') || command.includes('takeoff')) {
      takeOff();
    } else if (command.includes('land')) {
      land();
    } else if (command.includes('disarm')) {
      disarmDrone();
    } else {
      addLog(`Unknown command: "${command}"`, 'warning');
    }
  };

  const armDrone = () => {
    if (!droneState.armed) {
      setDroneState(prev => ({ ...prev, armed: true, propellerSpeed: 30 }));
      addLog('✓ Drone ARMED - Propellers spinning', 'success');
    } else {
      addLog('Drone already armed', 'warning');
    }
  };

  const disarmDrone = () => {
    if (droneState.armed && !droneState.flying) {
      setDroneState(prev => ({ ...prev, armed: false, propellerSpeed: 0 }));
      addLog('✓ Drone DISARMED', 'success');
    } else if (droneState.flying) {
      addLog('Cannot disarm while flying! Land first.', 'error');
    }
  };

  const takeOff = () => {
    if (!droneState.armed) {
      addLog('Cannot take off - Drone not armed!', 'error');
      return;
    }
    if (droneState.flying) {
      addLog('Drone already flying', 'warning');
      return;
    }

    setDroneState(prev => ({ ...prev, flying: true, propellerSpeed: 100 }));
    addLog('✓ Taking off...', 'success');
    
    // Animate altitude increase
    let currentAlt = 0;
    const targetAlt = 50;
    const interval = setInterval(() => {
      currentAlt += 2;
      if (currentAlt >= targetAlt) {
        currentAlt = targetAlt;
        clearInterval(interval);
        addLog(`✓ Hovering at ${targetAlt}m altitude`, 'success');
      }
      setDroneState(prev => ({ ...prev, altitude: currentAlt }));
    }, 50);
  };

  const land = () => {
    if (!droneState.flying) {
      addLog('Drone is not flying', 'warning');
      return;
    }

    addLog('✓ Landing...', 'success');
    
    // Animate altitude decrease
    const startAlt = droneState.altitude;
    let currentAlt = startAlt;
    const interval = setInterval(() => {
      currentAlt -= 2;
      if (currentAlt <= 0) {
        currentAlt = 0;
        clearInterval(interval);
        setDroneState(prev => ({ 
          ...prev, 
          flying: false, 
          altitude: 0, 
          propellerSpeed: 30 
        }));
        addLog('✓ Landed safely', 'success');
      } else {
        setDroneState(prev => ({ ...prev, altitude: currentAlt }));
      }
    }, 50);
  };

  const toggleListening = () => {
    if (!recognition) {
      addLog('Speech recognition not available', 'error');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      addLog('Voice control stopped', 'info');
    } else {
      recognition.start();
      setIsListening(true);
      addLog('Voice control activated - listening...', 'info');
    }
  };

  // Draw drone on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Ground
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(0, height - 30, width, 30);
      ctx.fillStyle = '#22c55e';
      for (let i = 0; i < width; i += 40) {
        ctx.fillRect(i, height - 30, 20, 30);
      }

      // Altitude lines
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let i = 50; i <= 100; i += 50) {
        const y = height - 30 - (i * 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px monospace';
        ctx.fillText(`${i}m`, 10, y - 5);
      }

      // Calculate drone position
      const droneY = height - 30 - (droneState.altitude * 2) - 40;
      const droneX = width / 2;

      // Propeller rotation
      if (droneState.propellerSpeed > 0) {
        propellerRotation.current += droneState.propellerSpeed / 10;
      }

      // Draw drone
      const drawPropeller = (x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((propellerRotation.current * Math.PI) / 180);
        ctx.strokeStyle = droneState.armed ? '#3b82f6' : '#9ca3af';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(15, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(0, 15);
        ctx.stroke();
        ctx.restore();
      };

      // Drone body
      ctx.fillStyle = droneState.armed ? '#1e40af' : '#6b7280';
      ctx.fillRect(droneX - 30, droneY - 10, 60, 20);
      
      // Arms
      ctx.strokeStyle = droneState.armed ? '#1e40af' : '#6b7280';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(droneX - 30, droneY);
      ctx.lineTo(droneX - 50, droneY - 20);
      ctx.moveTo(droneX + 30, droneY);
      ctx.lineTo(droneX + 50, droneY - 20);
      ctx.stroke();

      // Propellers
      drawPropeller(droneX - 50, droneY - 20);
      drawPropeller(droneX + 50, droneY - 20);

      // Status LED
      ctx.fillStyle = droneState.armed ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(droneX, droneY, 5, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [droneState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Radio className="text-blue-400" size={40} />
            Voice-Activated Drone Control
          </h1>
          <p className="text-slate-400">Speak commands: "Arm", "Take off", "Land", "Disarm"</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Simulator */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg shadow-xl p-6">
            <canvas 
              ref={canvasRef} 
              width={600} 
              height={400}
              className="w-full border-2 border-slate-700 rounded-lg bg-sky-100"
            />
            
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="bg-slate-700 p-3 rounded text-center">
                <div className="text-slate-400 text-sm">Status</div>
                <div className={`font-bold ${droneState.armed ? 'text-green-400' : 'text-red-400'}`}>
                  {droneState.armed ? 'ARMED' : 'DISARMED'}
                </div>
              </div>
              <div className="bg-slate-700 p-3 rounded text-center">
                <div className="text-slate-400 text-sm">Flight</div>
                <div className={`font-bold ${droneState.flying ? 'text-blue-400' : 'text-slate-400'}`}>
                  {droneState.flying ? 'FLYING' : 'GROUNDED'}
                </div>
              </div>
              <div className="bg-slate-700 p-3 rounded text-center">
                <div className="text-slate-400 text-sm">Altitude</div>
                <div className="font-bold text-cyan-400">{droneState.altitude.toFixed(0)}m</div>
              </div>
              <div className="bg-slate-700 p-3 rounded text-center">
                <div className="text-slate-400 text-sm">Propellers</div>
                <div className="font-bold text-purple-400">{droneState.propellerSpeed}%</div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* Voice Control */}
            <div className="bg-slate-800 rounded-lg shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">Voice Control</h2>
              <button
                onClick={toggleListening}
                className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                {isListening ? 'Stop Listening' : 'Start Voice Control'}
              </button>
              
              {lastCommand && (
                <div className="mt-4 p-3 bg-slate-700 rounded">
                  <div className="text-sm text-slate-400">Last Command:</div>
                  <div className="font-mono text-green-400">"{lastCommand}"</div>
                </div>
              )}
            </div>

            {/* Manual Controls */}
            <div className="bg-slate-800 rounded-lg shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">Manual Override</h2>
              <div className="space-y-2">
                <button
                  onClick={armDrone}
                  disabled={droneState.armed}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold transition-colors"
                >
                  Arm
                </button>
                <button
                  onClick={takeOff}
                  disabled={!droneState.armed || droneState.flying}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold transition-colors"
                >
                  Take Off
                </button>
                <button
                  onClick={land}
                  disabled={!droneState.flying}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold transition-colors"
                >
                  Land
                </button>
                <button
                  onClick={disarmDrone}
                  disabled={!droneState.armed || droneState.flying}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold transition-colors"
                >
                  Disarm
                </button>
              </div>
            </div>

            {/* System Log */}
            <div className="bg-slate-800 rounded-lg shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">System Log</h2>
              <div className="space-y-1 font-mono text-sm h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className={`
                    ${log.type === 'error' ? 'text-red-400' : ''}
                    ${log.type === 'success' ? 'text-green-400' : ''}
                    ${log.type === 'warning' ? 'text-yellow-400' : ''}
                    ${log.type === 'command' ? 'text-cyan-400' : ''}
                    ${log.type === 'info' ? 'text-slate-400' : ''}
                  `}>
                    <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-blue-400 flex-shrink-0 mt-1" size={20} />
          <div className="text-sm text-slate-300">
            <strong>Note:</strong> This simulator uses the Web Speech API for voice recognition. 
            Make sure to allow microphone access when prompted. Voice commands work best in Chrome/Edge browsers.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DroneSimulator;