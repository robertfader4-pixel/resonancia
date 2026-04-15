
const PLAYLIST = window.PLAYLIST || [];
const STORAGE_KEY = 'resonans-lyubvi-mini-player';

function formatTime(seconds){
  if(!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
function getState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch(e){ return {}; }
}
function setState(next){
  const current = getState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({...current, ...next}));
}

function buildAudioCandidates(track){
  const num = String(track.num).padStart(2,'0');
  const current = track.file || `assets/audio/${num}.mp3`;
  const altA = `assets/audio/${num}.mp3`;
  const altB = `assets/audio/cap${num}.mp3`;
  return [...new Set([current, altA, altB])];
}

function initMiniPlayer(defaultIndex = 0){
  const audio = document.getElementById('floatingAudio');
  const player = document.getElementById('miniPlayer');
  if(!audio || !player || !PLAYLIST.length) return;

  const head = document.getElementById('miniHead');
  const miniTitle = document.getElementById('miniPlayerTitle');
  const trackEl = document.getElementById('miniTrack');
  const chapterEl = document.getElementById('miniChapter');
  const playBtn = document.getElementById('miniPlayPause');
  const prevBtn = document.getElementById('miniPrev');
  const nextBtn = document.getElementById('miniNext');
  const progress = document.getElementById('miniProgress');
  const currentEl = document.getElementById('miniCurrentTime');
  const durationEl = document.getElementById('miniDuration');
  const volumeBar = document.getElementById('miniVolume');
  const minimizeBtn = document.getElementById('miniMinimize');
  const closeBtn = document.getElementById('miniClose');

  let state = getState();
  let currentIndex = Number.isInteger(state.index) ? state.index : defaultIndex;
  if(currentIndex < 0 || currentIndex >= PLAYLIST.length) currentIndex = defaultIndex;
  let currentCandidates = [];
  let currentCandidatePos = 0;
  let hasInitializedSrc = false;

  function updateTexts(track){
    miniTitle.textContent = 'Плеер';
    trackEl.textContent = track.trackName || `Тема главы ${String(track.num).padStart(2,'0')}`;
    chapterEl.textContent = `Глава ${String(track.num).padStart(2,'0')} · ${track.title}`;
  }

  function showPlayer(){
    player.classList.add('visible');
    setState({visible:true});
  }
  function hidePlayer(){
    player.classList.remove('visible');
    player.classList.remove('minimized');
    setState({visible:false, minimized:false});
  }
  function setMinimized(value){
    player.classList.toggle('minimized', value);
    setState({minimized:value});
  }

  async function tryPlay(){
    try{
      await audio.play();
      playBtn.textContent = '❚❚';
    }catch(e){
      playBtn.textContent = '▶';
    }
  }

  function setAudioSrc(src){
    audio.src = src;
    audio.load();
    setState({src});
  }

  function loadTrack(index, autoplay = false){
    currentIndex = index;
    const track = PLAYLIST[index];
    currentCandidates = buildAudioCandidates(track);
    currentCandidatePos = 0;
    updateTexts(track);
    setState({index: currentIndex, title: track.trackName, chapter: track.title});
    setAudioSrc(currentCandidates[currentCandidatePos]);
    hasInitializedSrc = true;
    if(autoplay){
      showPlayer();
      tryPlay();
    }else{
      playBtn.textContent = '▶';
    }
  }

  window.playChapterTrack = function(index){
    loadTrack(index, true);
  };

  [minimizeBtn, closeBtn, playBtn, prevBtn, nextBtn, progress, volumeBar].forEach(el => {
    if(!el) return;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => e.stopPropagation());
  });

  playBtn.addEventListener('click', () => {
    showPlayer();
    if(!hasInitializedSrc || !audio.src){
      loadTrack(currentIndex, true);
      return;
    }
    if(audio.paused) tryPlay();
    else audio.pause();
  });

  prevBtn.addEventListener('click', () => loadTrack((currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length, true));
  nextBtn.addEventListener('click', () => loadTrack((currentIndex + 1) % PLAYLIST.length, true));
  minimizeBtn.addEventListener('click', () => setMinimized(!player.classList.contains('minimized')));
  closeBtn.addEventListener('click', () => {
    audio.pause();
    hidePlayer();
  });

  audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; setState({playing:true}); });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; setState({playing:false}); });
  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
    const saved = getState();
    if(saved.src === audio.src && typeof saved.time === 'number' && saved.time < audio.duration){
      audio.currentTime = saved.time;
    }
  });

  audio.addEventListener('timeupdate', () => {
    const value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progress.value = value;
    currentEl.textContent = formatTime(audio.currentTime);
    setState({time: audio.currentTime, index: currentIndex});
  });

  audio.addEventListener('ended', () => loadTrack((currentIndex + 1) % PLAYLIST.length, true));

  audio.addEventListener('error', () => {
    if(currentCandidatePos + 1 < currentCandidates.length){
      currentCandidatePos += 1;
      setAudioSrc(currentCandidates[currentCandidatePos]);
      if(player.classList.contains('visible')){
        tryPlay();
      }
    }else{
      trackEl.textContent = 'Файл не найден';
      playBtn.textContent = '▶';
    }
  });

  progress.addEventListener('input', () => {
    if(!audio.duration) return;
    audio.currentTime = (Number(progress.value) / 100) * audio.duration;
  });

  volumeBar.addEventListener('input', () => {
    audio.volume = Number(volumeBar.value);
    setState({volume:Number(volumeBar.value)});
  });

  const savedVol = typeof state.volume === 'number' ? state.volume : Number(volumeBar.value || 0.85);
  audio.volume = savedVol;
  volumeBar.value = savedVol;

  const savedLeft = state.left;
  const savedTop = state.top;
  if(typeof savedLeft === 'number') player.style.left = savedLeft + 'px';
  if(typeof savedTop === 'number') player.style.top = savedTop + 'px';
  if(typeof savedLeft === 'number' || typeof savedTop === 'number'){
    player.style.right = 'auto';
    player.style.bottom = 'auto';
  }

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  head.addEventListener('pointerdown', (e) => {
    if(e.target.closest('button, input')) return;
    dragging = true;
    try { head.setPointerCapture && head.setPointerCapture(e.pointerId); } catch(_) {}
    const rect = player.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
  });

  window.addEventListener('pointermove', (e) => {
    if(!dragging) return;
    const left = Math.max(8, Math.min(window.innerWidth - player.offsetWidth - 8, e.clientX - offsetX));
    const top = Math.max(8, Math.min(window.innerHeight - player.offsetHeight - 8, e.clientY - offsetY));
    player.style.left = left + 'px';
    player.style.top = top + 'px';
    setState({left, top});
  });

  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  if(state.visible) showPlayer();
  if(state.minimized) setMinimized(true);
  
  const savedState = getState();
  if(savedState && savedState.src){
    audio.src = savedState.src;
    audio.currentTime = savedState.time || 0;
    if(savedState.playing){
      showPlayer();
      audio.play().catch(()=>{});
    }
  }

  loadTrack(currentIndex, false);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => initMiniPlayer(window.DEFAULT_TRACK_INDEX || 0));
}else{
  initMiniPlayer(window.DEFAULT_TRACK_INDEX || 0);
}
