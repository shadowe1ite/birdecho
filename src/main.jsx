import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bird, AudioLines, BookOpen, Leaf, Mic, ArrowUpRight, ArrowRight, Upload, Play, Square, ShieldCheck, Headphones, X, Check, MapPin, CalendarDays, Search, Download, Trash2, ChevronRight, Sparkles, Info, Sun, Feather, LoaderCircle, Plus } from 'lucide-react';
import { decodeAudio, time } from './audio';
import { getDiscoveries, saveDiscovery, removeDiscovery } from './storage';
import './style.css';

const navigation = [{ id: 'listen', name: 'Listen & discover', icon: AudioLines }, { id: 'collection', name: 'My collection', icon: Bird }, { id: 'journal', name: 'Field journal', icon: BookOpen }];
const facts = {
  'Erithacus rubecula': 'Robins sing through much of the year. Their bright orange breast helps them defend a territory—even against other robins.',
  'Parus major': 'Listen for a clear, repeating two-note song. Great tits have many calls, and often make their nests in holes in trees.',
  'Turdus merula': 'A blackbird’s rich, flute-like song often rings out at dawn and dusk. Males have black feathers and a bright yellow-orange bill.'
};
const date = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const compactFact = bird => facts[bird.scientific] || (bird.summary ? bird.summary.split(/(?<=\.)\s/).slice(0, 2).join(' ') : 'Every sound is a clue. Compare this suggestion with the bird’s appearance and the species found in your area.');

function Waveform({ stream, active }) {
  const canvas = useRef();
  useEffect(() => {
    const element = canvas.current; const ctx = element.getContext('2d'); let frame, audio, analyser;
    if (stream) {
      audio = new AudioContext(); analyser = audio.createAnalyser(); analyser.fftSize = 256;
      audio.createMediaStreamSource(stream).connect(analyser);
    }
    const data = new Uint8Array(128);
    function draw() {
      const width = 420, height = 74; element.width = width * 2; element.height = height * 2; ctx.scale(2, 2); ctx.clearRect(0, 0, width, height);
      if (analyser) analyser.getByteFrequencyData(data);
      for (let i = 0; i < 57; i++) {
        const envelope = Math.sin(i / 56 * Math.PI);
        const value = analyser ? data[i + 4] / 255 : .10 + Math.abs(Math.sin(i * .83)) * .32;
        const h = 4 + value * envelope * 56;
        ctx.fillStyle = active ? '#37644a' : '#d3dfcd'; ctx.beginPath(); ctx.roundRect(10 + i * 7.1, (height - h) / 2, 2.6, h, 2); ctx.fill();
      }
      if (active) frame = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(frame); if (audio) audio.close(); };
  }, [stream, active]);
  return <canvas className="waveform" ref={canvas} aria-hidden="true" />;
}

function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => { const element = ref.current; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }} aria-label={title}>
    <div className="dialog-top"><span className="eyebrow">BIRDECHO FIELD NOTES</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>
    <h2>{title}</h2>{children}
  </dialog>;
}

function Photo({ bird, className = '' }) {
  const [failed, setFailed] = useState(false);
  return bird.image && !failed ? <img className={className} src={bird.image} alt={bird.common} onError={() => setFailed(true)} /> : <div className={`photo-placeholder ${className}`}><Bird size={64} strokeWidth={1} /><span>Photo unavailable</span></div>;
}

function App() {
  const [page, setPage] = useState('listen'); const [guide, setGuide] = useState([]);
  const [discoveries, setDiscoveries] = useState([]); const [search, setSearch] = useState('');
  const [status, setStatus] = useState('idle'); const [stream, setStream] = useState(null); const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(null); const [results, setResults] = useState(null); const [progress, setProgress] = useState({ phase: '', value: 0 });
  const [error, setError] = useState(''); const [toast, setToast] = useState(''); const [modelReady, setModelReady] = useState(false);
  const [dialog, setDialog] = useState(null); const [place, setPlace] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [deleting, setDeleting] = useState(false);
  const [exportFile, setExportFile] = useState(null); const exportRef = useRef();
  const resultsRef = useRef(null); const fileInput = useRef(); const recorder = useRef(); const streamRef = useRef(); const worker = useRef(); const recordingRef = useRef(); const nextId = useRef(0); const activeId = useRef(); const started = useRef(); const timer = useRef(); const toastTimer = useRef(); const cancelled = useRef(false); const captureToken = useRef(0);
  const busy = ['requesting', 'analysing', 'loading'].includes(status); const recordingNow = status === 'recording';
  const uniqueCount = new Set(discoveries.map(bird => bird.scientific)).size;
  const days = new Set(discoveries.map(bird => new Date(bird.createdAt).toDateString())).size;

  useEffect(() => {
    fetch('/birds.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setGuide).catch(() => setError('The field guide could not load. You can still record and identify birds.'));
    getDiscoveries().then(setDiscoveries).catch(e => setError(e.message));
    return () => { cancelled.current = true; captureToken.current++; activeId.current = ++nextId.current; clearInterval(timer.current); clearTimeout(toastTimer.current); streamRef.current?.getTracks().forEach(track => track.stop()); worker.current?.terminate(); if (recordingRef.current?.url) URL.revokeObjectURL(recordingRef.current.url); if (exportRef.current) URL.revokeObjectURL(exportRef.current); };
  }, []);
  useEffect(() => { setSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [page]);
  // Identification results appear after the full recorder/field-guide grid.
  // On narrow phone screens that section can be several screens below the button,
  // so bring successful or no-match results into view as soon as they arrive.
  useEffect(() => {
    if (page !== 'listen' || results === null) return;
    const frame = requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultsRef.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [results, page]);
  function notify(message) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4200); }

  async function enrich(bird) {
    const known = guide.find(item => item.scientific === bird.scientific);
    if (known) return { ...known, ...bird };
    try {
      const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(bird.scientific.replaceAll(' ', '_')), { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error();
      const info = await response.json();
      if (info.type === 'disambiguation') throw new Error();
      const imageUrl = info.originalimage?.source || info.thumbnail?.source;
      const path = imageUrl ? new URL(imageUrl).pathname.split('/') : [];
      const filename = path.includes('thumb') ? path.at(-2) : path.at(-1);
      const photoSource = filename ? 'https://commons.wikimedia.org/wiki/File:' + decodeURIComponent(filename) : info.content_urls?.desktop?.page;
      return { ...bird, image: info.thumbnail?.source, summary: info.extract, source: info.content_urls?.desktop?.page, photoSource, artist: 'Wikimedia Commons contributor', license: 'See source for photographer and license' };
    } catch { return { ...bird, source: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(bird.scientific.replaceAll(' ', '_')) }; }
  }

  async function identify(current = recording) {
    if (!current || busy) return;
    setError(''); setResults(null); setStatus('analysing'); setProgress({ phase: 'Preparing your recording', value: 0 });
    const id = ++nextId.current; activeId.current = id;
    try {
      const { samples } = await decodeAudio(current.blob);
      if (activeId.current !== id) return;
      if (!worker.current) {
        worker.current = new Worker(new URL('./inference.worker.js', import.meta.url), { type: 'module' });
        worker.current.onerror = () => { setError('The bird expert could not start. Try an up-to-date browser with WebAssembly support.'); setStatus('ready'); worker.current?.terminate(); worker.current = null; setModelReady(false); };
        worker.current.onmessage = async ({ data }) => {
          if (data.id !== activeId.current) return;
          if (data.type === 'progress') setProgress({ phase: data.phase, value: data.value });
          if (data.type === 'ready') setModelReady(true);
          if (data.type === 'error') { setError(data.message); setStatus('ready'); }
          if (data.type === 'result') {
            setProgress({ phase: 'Gathering a few field notes', value: 100 });
            const enriched = await Promise.all(data.birds.map(enrich));
            if (data.id !== activeId.current) return;
            setResults(enriched); setStatus('result');
          }
        };
      }
      worker.current.postMessage({ id, audio: samples }, [samples.buffer]);
    } catch (e) { if (id === activeId.current) { setError(e.message); setStatus('ready'); } }
  }

  async function prepare(blob, origin = 'upload', run = false) {
    setError(''); setResults(null); setStatus('loading');
    try {
      const { duration } = await decodeAudio(blob);
      if (recordingRef.current?.url) URL.revokeObjectURL(recordingRef.current.url);
      const current = { blob, duration, origin, url: URL.createObjectURL(blob) };
      recordingRef.current = current; setRecording(current); setSeconds(0); setStatus('ready');
      if (run) await identify(current);
    } catch (e) { setError(e.message); setStatus(recordingRef.current ? 'ready' : 'idle'); }
  }

  function releaseMicrophone() { clearInterval(timer.current); streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setStream(null); }
  async function startRecording() {
    if (busy || recordingNow) return;
    setError(''); setStatus('requesting'); cancelled.current = false; const token = ++captureToken.current;
    try {
      if (!window.isSecureContext) throw new Error('Microphone access needs HTTPS or localhost. Open the secure BirdEcho link, or upload a recording.');
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('This browser cannot record audio. Try Chrome, Firefox, or Safari, or upload a recording.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (cancelled.current || token !== captureToken.current) { media.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = media; setStream(media);
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(value => MediaRecorder.isTypeSupported(value));
      recorder.current = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      const parts = []; recorder.current.ondataavailable = ({ data }) => { if (data.size) parts.push(data); };
      recorder.current.onstop = () => { releaseMicrophone(); prepare(new Blob(parts, { type: recorder.current.mimeType }), 'microphone'); };
      recorder.current.onerror = () => { cancelled.current = true; recorder.current.onstop = null; releaseMicrophone(); setStatus('idle'); setError('Recording was interrupted. Check microphone access and try again.'); };
      recorder.current.start(250); started.current = Date.now(); setSeconds(0); setResults(null); setStatus('recording');
      timer.current = setInterval(() => { const elapsed = (Date.now() - started.current) / 1000; setSeconds(elapsed); if (elapsed >= 30) stopRecording(); }, 200);
    } catch (e) {
      if (token !== captureToken.current) return;
      releaseMicrophone(); setStatus(recordingRef.current ? 'ready' : 'idle');
      setError(e.name === 'NotAllowedError' ? 'Microphone access was declined. Allow it in your browser’s site settings, or try a sample or upload.' : e.name === 'NotFoundError' ? 'No microphone was found. Connect one, or upload an audio file.' : e.message);
    }
  }
  function stopRecording() { if (recorder.current?.state === 'recording') { clearInterval(timer.current); recorder.current.stop(); setStatus('loading'); } }
  function cancelIdentification() { cancelled.current = true; captureToken.current++; activeId.current = ++nextId.current; worker.current?.terminate(); worker.current = null; setModelReady(false); setStatus(recordingRef.current ? 'ready' : 'idle'); }
  async function sample() {
    if (busy || recordingNow) return;
    setStatus('loading'); setError('');
    try { const response = await fetch('/audio/robin.ogg'); if (!response.ok) throw new Error('The sample could not load. Please try again.'); await prepare(await response.blob(), 'sample', true); }
    catch (e) { setError(e.message); setStatus('idle'); }
  }

  function openEntry(bird, existing = false) { setDialog({ type: 'entry', bird, existing }); setPlace(bird.place || ''); setNotes(bird.notes || ''); setDeleting(false); }
  async function saveEntry(event) {
    event.preventDefault(); if (saving) return; setSaving(true);
    try {
      const bird = dialog.bird; const item = { ...bird, id: dialog.existing ? bird.id : crypto.randomUUID(), createdAt: dialog.existing ? bird.createdAt : new Date().toISOString(), place: place.trim(), notes: notes.trim(), blob: dialog.existing ? bird.blob : recording.blob, duration: dialog.existing ? bird.duration : recording.duration, origin: dialog.existing ? bird.origin : recording.origin, model: 'BirdNET+ V3.0 Preview 3.1' };
      await saveDiscovery(item); setDiscoveries(await getDiscoveries()); setDialog(null); notify(dialog.existing ? 'Your field notes are saved.' : 'A new discovery, tucked into your journal.');
    } catch (e) { notify(e.message); }
    finally { setSaving(false); }
  }
  async function deleteEntry() { try { await removeDiscovery(dialog.bird.id); setDiscoveries(await getDiscoveries()); setDialog(null); notify('Discovery removed from your journal.'); } catch (e) { notify(e.message); } }
  async function exportJournal() {
    try {
      const entries = await Promise.all(discoveries.map(async ({ blob, ...item }) => ({ ...item, audio: { mimeType: blob.type, base64: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }) } })));
      const blob = new Blob([JSON.stringify({ app: 'BirdEcho', exportedAt: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' });
      if (exportRef.current) URL.revokeObjectURL(exportRef.current);
      const url = URL.createObjectURL(blob); exportRef.current = url; setExportFile({ url, size: Math.round(blob.size / 1024) });
      const a = document.createElement('a'); a.href = url; a.download = 'birdecho-journal.json'; document.body.append(a); a.click(); a.remove(); notify('Journal ready, including your recordings.');
    } catch { notify('Your journal could not be exported. Please try again.'); }
  }
  const filtered = [...discoveries].filter(bird => [bird.common, bird.scientific, bird.notes, bird.place].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const featured = guide[0] || { common: 'European robin', scientific: 'Erithacus rubecula', image: '/images/robin.jpg' };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#listen" onClick={e => { e.preventDefault(); setPage('listen'); }}><span className="brand-icon"><Bird size={27} strokeWidth={1.7} /></span>BirdEcho<span className="brand-dot">.</span></a>
      <div className="sidebar-label">YOUR LITTLE PATCH OF WILD</div>
      <nav aria-label="Main navigation">{navigation.map(({ id, name, icon: Icon }) => <button key={id} onClick={() => setPage(id)} className={`nav-item ${page === id ? 'selected' : ''}`} aria-current={page === id ? 'page' : undefined}><Icon size={20} /><span>{name}</span>{page === id && <span className="nav-dot" />}{id === 'collection' && page !== id && <span className="nav-count">{uniqueCount}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="challenge"><div className="challenge-icon"><Leaf size={20} /></div><p>A good reason<br />to go outside.</p><span>HACKTOBERFEST 2026</span><div className="challenge-line" /><div className="challenge-week">WEEK 01 <span>Touch Grass <ArrowUpRight size={13} /></span></div></div><button className="about-button" onClick={() => setDialog({ type: 'about' })}><Info size={17} /> About BirdEcho <ArrowUpRight size={15} /></button><div className="made-with">Made for curious ears <Leaf size={12} /></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb">Your nature companion<span>/</span><strong>{navigation.find(x => x.id === page).name}</strong></div><div className="topbar-right"><span className="local-badge"><span /> On-device & private</span><button className="profile-button" aria-label="About your local journal" onClick={() => setDialog({ type: 'privacy' })}><Leaf size={18} /></button></div></header>
      <div className="content">
        {page === 'listen' ? <>
          <section className="welcome"><div><div className="eyebrow"><Sun size={14} /> LESS SCROLLING. MORE BIRDSONG.</div><h1>A little outside.<br /><em>A lot to discover.</em></h1><p>There’s a whole world singing around you.<br className="desktop-break" /> Slow down, tune in, and meet your feathered neighbors.</p></div><div className="welcome-note"><span className="tiny-spark">✳</span><span>You don’t have to go far.<br /><strong>Just listen a little closer.</strong></span></div></section>
          <div className="listen-grid">
            <section className={`recorder-card ${recordingNow ? 'is-recording' : ''}`} aria-label="Bird sound recorder">
              <div className="card-heading"><span className="step-label"><span>01</span> LET NATURE DO THE TALKING</span><span className="live-status"><span /> {recordingNow ? 'Listening' : modelReady ? 'BirdNET ready' : 'Ready when you are'}</span></div>
              <div className="recorder-body"><div className={`microphone-orbit ${recordingNow ? 'pulsing' : ''}`}><button className="microphone" disabled={busy} onClick={recordingNow ? stopRecording : startRecording} aria-label={recordingNow ? 'Stop recording' : 'Start recording'}>{recordingNow ? <Square size={30} fill="currentColor" /> : busy ? <LoaderCircle className="spin" size={34} /> : <Mic size={36} strokeWidth={1.6} />}</button><span className="orbit-dot one" /><span className="orbit-dot two" /></div>
              <h2>{recordingNow ? 'A moment of birdsong.' : status === 'analysing' ? 'Who’s singing out there?' : recording ? 'A little sound. A new discovery.' : 'Who’s singing out there?'}</h2>
              <p>{recordingNow ? 'Keep still and let the birds come to you.' : recording ? 'Listen back, then let BirdNET find the birds.' : 'Record a bird. Discover its story.'}</p>
              <Waveform stream={stream} active={recordingNow} />
              {recordingNow ? <div className="recording-time"><span className="recording-dot" />{time(seconds)}<span>/ 00:30</span></div> : status === 'analysing' ? <div className="analysis-progress" aria-live="polite"><div><span>{progress.phase}</span><strong>{progress.value}%</strong></div><progress max="100" value={progress.value} /></div> : <div className="record-hint"><Headphones size={14} /><span>A clear 10–30 seconds works best</span></div>}
              <div className="record-actions">{status === 'requesting' ? <button className="primary-button" onClick={cancelIdentification}>Cancel microphone request</button> : status === 'analysing' ? <button className="primary-button" onClick={cancelIdentification}>Cancel identification</button> : recordingNow ? <button className="primary-button" onClick={stopRecording}><Square size={16} fill="currentColor" /> Stop recording</button> : <button className="primary-button" onClick={startRecording} disabled={busy}><Mic size={17} />{recording ? 'Record again' : status === 'requesting' ? 'Allow microphone access…' : 'Start listening'}{!busy && <ArrowRight size={17} />}</button>}</div>
              {recording && !recordingNow && status !== 'analysing' && <div className="audio-review"><div className="audio-caption"><AudioLines size={16} /><span>{recording.origin === 'sample' ? 'Sample birdsong' : 'Your recording'} · {time(recording.duration)}</span></div><audio controls src={recording.url} aria-label="Listen to your recording" />{results === null
                ? <button className="identify-button" disabled={busy} onClick={() => identify()}><Sparkles size={16} /> Identify birds <ArrowRight size={15} /></button>
                : <button className="identify-button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Check size={16} /> {results.length ? `View ${results.length} bird matches` : 'View identification result'} <ArrowRight size={15} /></button>}
                {error && <div className="error-box" role="alert"><Info size={17} /><span>{error}</span></div>}</div>}
              <div className="alternative-actions"><button onClick={() => fileInput.current.click()} disabled={busy || recordingNow}><Upload size={15} /> Upload audio</button><span /><button onClick={sample} disabled={busy || recordingNow}><Play size={14} /> Try a sample</button><input ref={fileInput} type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.webm" hidden onChange={e => { const file = e.target.files[0]; e.target.value = ''; if (file) prepare(file); }} aria-label="Upload bird audio" /></div>
              {error && !recording && <div className="error-box" role="alert"><Info size={17} /><span>{error}</span></div>}
              </div><div className="recorder-footer"><ShieldCheck size={15} /><span>Your audio stays yours. Identification happens on your device.</span></div>
            </section>
            <div className="right-column"><section className="hero-bird"><Photo bird={featured} /><div className="hero-bird-shade" /><span className="hero-badge"><Leaf size={13} /> A MOMENT IN THE WILD</span><div className="hero-bird-text"><span>SMALL BIRD. BIG PERSONALITY.</span><h2>Wonder is<br />closer than you think.</h2><button onClick={() => setDialog({ type: 'bird', bird: featured })}>Meet the European robin <ArrowUpRight size={17} /></button></div><a className="hero-credit" href={featured.photoSource || 'https://commons.wikimedia.org/wiki/File:Erithacus_rubecula_with_cocked_head.jpg'} target="_blank" rel="noreferrer" aria-label="Bird photograph credit">© Francis C. Franklin · CC BY-SA 3.0</a></section>
              <section className="field-tip"><div className="tip-symbol"><Sun size={24} strokeWidth={1.4} /></div><div><span className="eyebrow">A LITTLE FIELD WISDOM</span><h3>The early bird has a point.</h3><p>Try a quiet spot around sunrise. Keep your phone still, and give the birds some space.</p></div><Leaf className="tip-leaf" size={58} strokeWidth={.6} /></section></div>
          </div>
          {results !== null && <section ref={resultsRef} className="results-section" aria-live="polite"><div className="section-heading"><div><span className="eyebrow">THE VOICES IN YOUR RECORDING</span><h2>{results.length ? 'Look who you found.' : 'A little more listening?'}</h2></div>{results.length > 0 && <span className="soft-badge">{results.length} possible {results.length === 1 ? 'species' : 'species'}</span>}</div>{results.length ? <><p className="result-caveat">These are model suggestions, not confirmed sightings. Confidence is a model score; compare with birds found in your area.</p><div className="result-grid">{results.map(bird => <article className="result-card" key={bird.scientific}><Photo bird={bird} /><div className="result-card-content"><span className={`confidence ${bird.confidence < .7 ? 'uncertain' : ''}`}>{Math.round(bird.confidence * 100)}% confidence {bird.confidence < .7 && '· tentative'}</span><h3>{bird.common}</h3><i>{bird.scientific}</i><p>{compactFact(bird)}</p><div className="match-time">Heard at {time(bird.start)}–{time(bird.end)}</div><button className="primary-button" onClick={() => openEntry(bird)}><Plus size={16} /> Save discovery</button></div></article>)}</div></> : <div className="no-match"><Feather size={34} /><p>No bird passed the 25% confidence threshold. Try a closer, clearer recording without wind or conversation.</p><button className="text-button" onClick={startRecording}>Listen again <ArrowRight size={16} /></button></div>}</section>}
          <section className="journey-section"><div className="section-heading"><div className="section-title-inline"><h2>Your journey, one bird at a time.</h2><span>Every little discovery counts.</span></div><button className="text-button" onClick={() => setPage('collection')}>View collection <ArrowRight size={16} /></button></div><div className="journey-stats"><div className="journey-stat"><span className="stat-icon"><Bird size={23} strokeWidth={1.5} /></span><strong>{uniqueCount.toString().padStart(2, '0')}</strong><div>Unique species<span>A growing world of birds</span></div></div><div className="journey-stat"><span className="stat-icon"><AudioLines size={23} strokeWidth={1.5} /></span><strong>{discoveries.length.toString().padStart(2, '0')}</strong><div>Saved discoveries<span>Little moments, kept forever</span></div></div><div className="journey-stat"><span className="stat-icon"><Leaf size={23} strokeWidth={1.5} /></span><strong>{days.toString().padStart(2, '0')}</strong><div>Days of discovery<span>More time with the outside</span></div></div></div></section>
          <section className="guide-section"><div className="section-heading"><div><span className="eyebrow">A FEW FAMILIAR FACES</span><h2>Meet the morning chorus.</h2></div><span className="guide-label">FROM THE FIELD GUIDE <BookOpen size={15} /></span></div><div className="guide-grid">{guide.map((bird, index) => <button className="guide-card" key={bird.scientific} onClick={() => setDialog({ type: 'bird', bird })}><div className="guide-image"><Photo bird={bird} /><span>{['THE GARDEN COMPANION', 'THE TWO-NOTE SINGER', 'THE DAWN SOLOIST'][index]}</span></div><div className="guide-card-info"><div><h3>{bird.common}</h3><i>{bird.scientific}</i></div><span className="round-arrow"><ArrowUpRight size={18} /></span></div></button>)}</div></section>
        </> : <>
          <section className="welcome collection-welcome"><div><div className="eyebrow"><Leaf size={14} /> LITTLE MOMENTS, BEAUTIFULLY KEPT</div><h1>{page === 'collection' ? <>Your own<br /><em>little patch of wild.</em></> : <>Notes from<br /><em>the outside.</em></>}</h1><p>{page === 'collection' ? `${uniqueCount} unique species. ${discoveries.length} ${discoveries.length === 1 ? 'discovery' : 'discoveries'}. A world still waiting to be heard.` : 'The sounds, the places, and the things you noticed along the way.'}</p></div>{discoveries.length > 0 && <button className="secondary-button" onClick={exportJournal}><Download size={16} /> Export journal</button>}</section>
          {exportFile && <a className="export-download" href={exportFile.url} download="birdecho-journal.json"><Download size={16} /> Download prepared journal <span>{exportFile.size} KB · notes & recordings</span></a>}{discoveries.length ? <><div className="collection-toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search birds, places, or notes…" aria-label="Search your discoveries" /></label><span>{filtered.length} {filtered.length === 1 ? 'discovery' : 'discoveries'}</span></div>{filtered.length ? <div className={page === 'collection' ? 'collection-grid' : 'journal-list'}>{filtered.map(bird => page === 'collection' ? <button className="discovery-card" key={bird.id} onClick={() => openEntry(bird, true)}><div className="discovery-image"><Photo bird={bird} /><span className="confidence">{Math.round(bird.confidence * 100)}% confidence</span>{bird.origin === 'sample' && <span className="sample-tag">SAMPLE RECORDING</span>}</div><div className="discovery-content"><h3>{bird.common}</h3><i>{bird.scientific}</i><div className="discovery-meta"><span><CalendarDays size={13} />{date(bird.createdAt)}</span>{bird.place && <span><MapPin size={13} />{bird.place}</span>}</div><span className="text-button">Open field notes <ArrowUpRight size={16} /></span></div></button> : <article className="journal-entry" key={bird.id}><div className="journal-date"><span>{new Date(bird.createdAt).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span><strong>{new Date(bird.createdAt).getDate()}</strong></div><Photo bird={bird} /><div className="journal-content"><span className="eyebrow">{bird.origin === 'sample' ? 'A SAMPLE DISCOVERY' : 'A MOMENT OUTSIDE'} · {Math.round(bird.confidence * 100)}% CONFIDENCE</span><h2>{bird.common}</h2>{bird.place && <span className="place"><MapPin size={14} />{bird.place}</span>}<p>{bird.notes || 'The start of a story. Add a few notes about what you noticed.'}</p><button className="text-button" onClick={() => openEntry(bird, true)}>Listen & edit notes <ArrowRight size={16} /></button></div></article>)}</div> : <div className="empty-state"><Search size={40} strokeWidth={1.2} /><h2>No discoveries found.</h2><p>Try another bird, place, or word from your notes.</p><button className="text-button" onClick={() => setSearch('')}>Clear search <X size={15} /></button></div>}</> : <section className="empty-state first-discovery"><div className="empty-illustration"><Bird size={80} strokeWidth={1} /><Leaf className="leaf-left" size={28} strokeWidth={1} /><Feather className="leaf-right" size={32} strokeWidth={1} /></div><span className="eyebrow">EVERY JOURNEY STARTS WITH A CHIRP</span><h2>{page === 'collection' ? 'Your first bird is out there.' : 'A blank page. A whole world outside.'}</h2><p>Record a little birdsong, identify it, and save your discovery.<br />We’ll keep its sound and your field notes right here.</p><button className="primary-button" onClick={() => setPage('listen')}><Mic size={17} /> Make your first discovery <ArrowRight size={16} /></button></section>}
        </>}
        <footer className="page-footer"><span><Bird size={15} /> Leave only footprints. Take home a little wonder.</span><button onClick={() => setDialog({ type: 'about' })}>Powered by BirdNET <ArrowUpRight size={12} /></button></footer>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map(({ id, name, icon: Icon }) => <button key={id} aria-label={name} className={page === id ? 'selected' : ''} onClick={() => setPage(id)}><Icon size={21} /><span>{id === 'listen' ? 'Discover' : id === 'collection' ? 'Collection' : 'Journal'}</span></button>)}</nav>
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
    {dialog?.type === 'bird' && <Dialog title={dialog.bird.common} onClose={() => setDialog(null)}><Photo bird={dialog.bird} className="dialog-photo" /><i className="scientific">{dialog.bird.scientific}</i><p>{compactFact(dialog.bird)}</p>{dialog.bird.summary && <p className="muted">{dialog.bird.summary.split(/(?<=\.)\s/).slice(0, 3).join(' ')}</p>}<a className="text-button" href={dialog.bird.source} target="_blank" rel="noreferrer">More field notes on Wikipedia <ArrowUpRight size={16} /></a><PhotoCredit bird={dialog.bird} /></Dialog>}
    {dialog?.type === 'entry' && <Dialog title={dialog.existing ? 'A moment, remembered.' : 'Keep this little discovery.'} onClose={() => { if (!saving) setDialog(null); }}><div className="entry-bird"><Photo bird={dialog.bird} /><div><h3>{dialog.bird.common}</h3><i>{dialog.bird.scientific}</i><span className="confidence">{Math.round(dialog.bird.confidence * 100)}% model confidence</span></div></div>{dialog.bird.origin === 'sample' || (!dialog.existing && recording?.origin === 'sample') ? <p className="sample-notice">This came from the sample recording. It will be labeled as a sample in your journal.</p> : null}<SavedAudio blob={dialog.existing ? dialog.bird.blob : recording?.blob} /><form onSubmit={saveEntry}><label className="form-label">Where were you listening? <span>optional</span><div className="input-with-icon"><MapPin size={17} /><input value={place} onChange={e => setPlace(e.target.value)} placeholder="A garden, a trail, your favorite park…" maxLength={120} /></div></label><label className="form-label">Your field notes <span>optional</span><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What did you notice? A quiet morning, a flash of color, a song you hadn’t heard before…" rows={4} maxLength={2000} /></label><div className="entry-form-actions"><button type="submit" className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <BookOpen size={16} />}{dialog.existing ? 'Save field notes' : 'Save to my journal'}</button>{dialog.existing && <button type="button" className="icon-button danger" aria-label="Delete discovery" onClick={() => setDeleting(!deleting)}><Trash2 size={18} /></button>}</div>{deleting && <div className="delete-confirm"><p>Remove this discovery and its recording from your journal?</p><button type="button" onClick={deleteEntry}>Yes, remove discovery</button><button type="button" onClick={() => setDeleting(false)}>Keep it</button></div>}</form><p className="storage-note"><ShieldCheck size={13} /> Saved in this browser. Export your journal to keep a backup.</p><PhotoCredit bird={dialog.bird} /></Dialog>}
    {dialog?.type === 'about' && <Dialog title="A little closer to nature." onClose={() => setDialog(null)}><div className="about-art"><Bird size={70} strokeWidth={1} /><AudioLines size={50} strokeWidth={1} /></div><p>BirdEcho is a free nature companion for the Hacktoberfest Week 1 “Touch Grass” challenge. Record a bird, learn its name, and keep the moment.</p><h3>A real bird expert, on your device.</h3><p>Identification uses the unmodified BirdNET+ V3.0 Preview 3.1 neural network, running in your browser with ONNX Runtime. On first use it downloads about 68 MB of model weights. There are no paid APIs and no audio uploads.</p><p className="muted">This is an experimental model. Wind, background sounds, and unfamiliar species may produce incorrect matches. Scores are suggestions, not certainty.</p><h3>With thanks to BirdNET.</h3><p>Lasseck, M., Eibl, M., Klinck, H., & Kahl, S. (2026). BirdNET+ V3.0 model developer preview (Preview 3.1).</p><div className="about-links"><a href="https://doi.org/10.5281/zenodo.20703646" target="_blank" rel="noreferrer">Model source <ArrowUpRight size={14} /></a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0 <ArrowUpRight size={14} /></a><a href="/models/TERMS_OF_USE.txt" target="_blank" rel="noreferrer">Model terms <ArrowUpRight size={14} /></a></div><p className="small-text">The preview is provided for research and evaluation. Its terms prohibit military use and uses that facilitate poaching. BirdEcho is an independent educational project, without affiliation or endorsement by BirdNET.</p><p className="small-text">Sample audio: Vladimir Yu. Arkhipov (Arkhivov), European robin song. Unmodified, <a href="https://commons.wikimedia.org/wiki/File:Erithacus_rubecula.ogg" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>. Photos and bird descriptions link to their sources in each field note.</p></Dialog>}
    {dialog?.type === 'privacy' && <Dialog title="Your own little journal." onClose={() => setDialog(null)}><ShieldCheck className="privacy-icon" size={58} strokeWidth={1.2} /><p>Your recordings, discoveries, and field notes are saved in this browser on this device. You don’t need an account.</p><p>Audio identification happens on your device. Bird descriptions and photos may be requested from Wikipedia; only the species name is sent, never your recording.</p><p>Clearing browser data will remove your journal. Use “Export journal” in your collection to back up your notes and recordings. A different browser or device will have its own collection.</p><button className="primary-button" onClick={() => { setDialog(null); setPage('collection'); }}>Open my collection <ArrowRight size={16} /></button></Dialog>}
  </div>;
}

function SavedAudio({ blob }) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!blob) return; const value = URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [blob]);
  return url ? <audio className="saved-audio" controls src={url} aria-label="Listen to saved birdsong" /> : null;
}
function PhotoCredit({ bird }) {
  return <div className="photo-credit">{bird.photoSource && <a href={bird.photoSource} target="_blank" rel="noreferrer">Photo: {bird.artist || 'Wikimedia Commons'} · {bird.license || 'see source for license'}</a>}{bird.source && <a href={bird.source} target="_blank" rel="noreferrer">Field notes: Wikipedia contributors · CC BY-SA 4.0</a>}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
