// Motor de áudio - thread dedicada que detém a OutputStream/Sink (tipos !Send do rodio)
use crate::dsp::{DspParams, DspSource, Meters};
use crossbeam_channel::{unbounded, Receiver, Sender};
use rodio::{Decoder, OutputStream, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub enum AudioCmd {
    Play {
        id: String,
        path: String,
        duration_ms: u64,
    },
    Pause,
    Resume,
    Stop,
    Sfx {
        path: String,
    },
    SetMaster(f32),
}

pub struct NowPlayingInfo {
    pub id: String,
    pub duration_ms: u64,
    pub started: Instant,
}

#[derive(Clone)]
pub struct AudioHandle {
    pub tx: Sender<AudioCmd>,
    pub meters: Arc<Meters>,
    pub params: Arc<DspParams>,
    pub current: Arc<Mutex<Option<NowPlayingInfo>>>,
}

impl AudioHandle {
    pub fn send(&self, cmd: AudioCmd) {
        let _ = self.tx.send(cmd);
    }

    pub fn position_ms(&self) -> u64 {
        let sr = self
            .meters
            .sample_rate
            .load(std::sync::atomic::Ordering::Relaxed)
            .max(1) as u64;
        let frames = self
            .meters
            .position_frames
            .load(std::sync::atomic::Ordering::Relaxed);
        frames.saturating_mul(1000) / sr
    }

    pub fn duration_ms(&self) -> u64 {
        self.current
            .lock()
            .ok()
            .and_then(|c| c.as_ref().map(|i| i.duration_ms))
            .unwrap_or(0)
    }

    pub fn is_active(&self) -> bool {
        self.current.lock().map(|c| c.is_some()).unwrap_or(false)
    }
}

pub fn spawn_audio() -> AudioHandle {
    let (tx, rx) = unbounded();
    let meters = Arc::new(Meters::new());
    let params = Arc::new(DspParams::new());
    let current: Arc<Mutex<Option<NowPlayingInfo>>> = Arc::new(Mutex::new(None));

    let a = meters.clone();
    let b = params.clone();
    let c = current.clone();
    std::thread::spawn(move || audio_thread(rx, a, b, c));

    AudioHandle {
        tx,
        meters,
        params,
        current,
    }
}

fn audio_thread(
    rx: Receiver<AudioCmd>,
    meters: Arc<Meters>,
    params: Arc<DspParams>,
    current: Arc<Mutex<Option<NowPlayingInfo>>>,
) {
    let (_stream, handle) = match OutputStream::try_default() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[audio] Falha ao abrir dispositivo de saída: {e}");
            return;
        }
    };

    let music = match Sink::try_new(&handle) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[audio] Falha ao criar sink de música: {e}");
            return;
        }
    };
    let sfx = match Sink::try_new(&handle) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[audio] Falha ao criar sink de efeitos: {e}");
            return;
        }
    };

    let mut playing = false;

    loop {
        match rx.recv_timeout(Duration::from_millis(40)) {
            Ok(AudioCmd::Play {
                id,
                path,
                duration_ms,
            }) => {
                music.stop();
                match File::open(&path) {
                    Ok(file) => match Decoder::new(BufReader::new(file)) {
                        Ok(decoder) => {
                            let src = decoder.convert_samples::<f32>();
                            let dsp = DspSource::new(src, params.clone(), meters.clone());
                            music.append(dsp);
                            music.play();
                            meters
                                .ended
                                .store(false, std::sync::atomic::Ordering::SeqCst);
                            meters
                                .position_frames
                                .store(0, std::sync::atomic::Ordering::SeqCst);
                            if let Ok(mut cur) = current.lock() {
                                *cur = Some(NowPlayingInfo {
                                    id,
                                    duration_ms,
                                    started: Instant::now(),
                                });
                            }
                            playing = true;
                        }
                        Err(e) => eprintln!("[audio] Falha ao decodificar {path}: {e}"),
                    },
                    Err(e) => eprintln!("[audio] Falha ao abrir {path}: {e}"),
                }
            }
            Ok(AudioCmd::Pause) => {
                music.pause();
                meters.reset();
            }
            Ok(AudioCmd::Resume) => music.play(),
            Ok(AudioCmd::Stop) => {
                music.stop();
                playing = false;
                meters.reset();
                if let Ok(mut cur) = current.lock() {
                    *cur = None;
                }
            }
            Ok(AudioCmd::Sfx { path }) => {
                if let Ok(file) = File::open(&path) {
                    if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                        sfx.append(decoder);
                        sfx.play();
                    }
                }
            }
            Ok(AudioCmd::SetMaster(v)) => params.set_master(v),
            Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
            Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
        }

        if playing && music.empty() {
            playing = false;
            meters.reset();
            if let Ok(mut cur) = current.lock() {
                *cur = None;
            }
            meters
                .ended
                .store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }
}
