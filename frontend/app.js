(function(){
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const armedEl = document.getElementById('armed');
  const motorsEl = document.getElementById('motors');
  const altitudeEl = document.getElementById('altitude');
  const targetEl = document.getElementById('target');
  const canvas = document.getElementById('sim');
  const ctx = canvas.getContext('2d');
  let state = {armed:false, motors_on:false, altitude:0, target_altitude:0};

  function draw(){
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    // ground
    ctx.fillStyle = '#6bb06b';
    ctx.fillRect(0, h-40, w, 40);
    // drone
    const droneX = w/2;
    const maxH = h-80;
    const alt = Math.min(state.altitude, 10);
    const y = (maxH) - (alt / 10) * maxH;
    // shadow
    ctx.beginPath();
    const shadowR = 30 - Math.min(state.altitude, 10)*2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.ellipse(droneX, h-30, shadowR, 8, 0, 0, Math.PI*2);
    ctx.fill();
    // body
    ctx.fillStyle = state.armed ? '#ff6b6b' : '#333';
    ctx.beginPath();
    ctx.arc(droneX, y, 18, 0, Math.PI*2);
    ctx.fill();
    // propellers
    ctx.strokeStyle = '#222';
    for(let i=0;i<4;i++){
      const angle = (i * Math.PI/2) + (performance.now()/500 % (Math.PI*2)) * (state.motors_on?1.5:0);
      const x1 = droneX + Math.cos(angle)*30;
      const y1 = y + Math.sin(angle)*30;
      ctx.beginPath();
      ctx.moveTo(droneX, y);
      ctx.lineTo(x1,y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x1,y1,8,0,Math.PI*2);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  ws.addEventListener('message', ev => {
    try{
      const msg = JSON.parse(ev.data);
      if(msg.type === 'state'){
        state = msg.state;
        armedEl.textContent = state.armed;
        motorsEl.textContent = state.motors_on ? 'on' : 'off';
        altitudeEl.textContent = state.altitude.toFixed(2);
        targetEl.textContent = state.target_altitude.toFixed(2);
      }
    }catch(e){ console.warn(e); }
  });

  function sendCmd(cmd){
    ws.send(JSON.stringify(cmd));
  }

  document.getElementById('btn-arm').addEventListener('click', ()=> sendCmd({cmd:'arm'}));
  document.getElementById('btn-takeoff').addEventListener('click', ()=> {
    const alt = parseFloat(document.getElementById('alt-input').value) || 3.0;
    sendCmd({cmd:'takeoff', alt});
  });
  document.getElementById('btn-hover').addEventListener('click', ()=> sendCmd({cmd:'hover'}));
  document.getElementById('btn-set-alt').addEventListener('click', ()=> {
    const alt = parseFloat(document.getElementById('alt-input').value) || 3.0;
    sendCmd({cmd:'set_altitude', alt});
  });
  document.getElementById('btn-land').addEventListener('click', ()=> sendCmd({cmd:'land'}));

  document.getElementById('send-manual').addEventListener('click', ()=>{
    const txt = document.getElementById('manual-cmd').value.trim().toLowerCase();
    if(!txt) return;
    if(txt.startsWith('arm')) sendCmd({cmd:'arm'});
    else if(txt.startsWith('take')) sendCmd({cmd:'takeoff', alt: parseFloat(document.getElementById('alt-input').value) || 3.0});
    else if(txt.startsWith('land')) sendCmd({cmd:'land'});
  });

  // Voice recognition
  let recognition = null;
  const startBtn = document.getElementById('start-voice');
  const stopBtn = document.getElementById('stop-voice');

  function setupRecognition(){
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return null;
    const r = new SpeechRecognition();
    r.lang = 'en-US';
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (ev)=>{
      const last = ev.results[ev.results.length-1];
      const transcript = last[0].transcript.trim().toLowerCase();
      console.log('voice:', transcript);
      if(transcript.includes('arm')){
        sendCmd({cmd:'arm'});
      } else if(transcript.includes('hover')){
        sendCmd({cmd:'hover'});
      } else {
        // detect "set altitude to 5" or "altitude 5"
        const m = transcript.match(/(?:set altitude to|set altitude|altitude to|altitude)\s*(\d+(?:\.\d+)?)/i);
        if(m){
          const alt = parseFloat(m[1]);
          if(!isNaN(alt)) sendCmd({cmd:'set_altitude', alt});
        } else if(transcript.includes('take off') || transcript.includes('takeoff')){
          const alt = parseFloat(document.getElementById('alt-input').value) || 3.0;
          sendCmd({cmd:'takeoff', alt});
        } else if(transcript.includes('land')){
          sendCmd({cmd:'land'});
        }
      }
    };
    r.onerror = (e)=> console.warn('recognition error', e);
    return r;
  }

  startBtn.addEventListener('click', ()=>{
    if(!recognition) recognition = setupRecognition();
    if(!recognition){ alert('SpeechRecognition not supported in this browser. Use Chrome/Edge.'); return; }
    recognition.start();
    startBtn.disabled = true; stopBtn.disabled = false;
  });
  stopBtn.addEventListener('click', ()=>{
    if(recognition) recognition.stop();
    startBtn.disabled = false; stopBtn.disabled = true;
  });

})();