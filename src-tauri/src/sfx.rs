// Gera (uma única vez) o efeito sonoro "ka-ching" da caixa registradora em WAV PCM.
use std::f32::consts::PI;
use std::fs;
use std::path::Path;

const SR: u32 = 44100;

fn write_wav(path: &Path, samples: &[f32]) -> Result<(), String> {
    let data_len = (samples.len() * 2) as u32;
    let mut buf: Vec<u8> = Vec::with_capacity(44 + data_len as usize);
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&(36 + data_len).to_le_bytes());
    buf.extend_from_slice(b"WAVE");
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());
    buf.extend_from_slice(&1u16.to_le_bytes()); // PCM
    buf.extend_from_slice(&1u16.to_le_bytes()); // mono
    buf.extend_from_slice(&SR.to_le_bytes());
    buf.extend_from_slice(&(SR * 2).to_le_bytes()); // byte rate
    buf.extend_from_slice(&2u16.to_le_bytes()); // block align
    buf.extend_from_slice(&16u16.to_le_bytes()); // bits
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        let v = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
        buf.extend_from_slice(&v.to_le_bytes());
    }
    fs::write(path, buf).map_err(|e| e.to_string())
}

/// Cria o arquivo se não existir e devolve o caminho.
pub fn ensure_cash_sound(dir: &Path) -> Result<String, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join("caixa_retro.wav");
    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }

    let total = (SR as f32 * 1.4) as usize;
    let mut out = vec![0f32; total];

    // 1) Sino "ka-ching": dois tons com decaimento
    for (i, sample) in out.iter_mut().enumerate() {
        let t = i as f32 / SR as f32;
        let env = (-6.0 * t).exp();
        let a = (2.0 * PI * 1480.0 * t).sin();
        let b = (2.0 * PI * 2093.0 * t).sin() * if t > 0.08 { 1.0 } else { 0.0 };
        let ring = (2.0 * PI * 2960.0 * t).sin() * (-10.0 * t).exp() * 0.3;
        *sample += (a * 0.5 + b * 0.45 + ring) * env * 0.5;
    }

    // 2) Moedas caindo (ruído filtrado em alta frequência)
    let mut seed: u32 = 0x1234_5678;
    for k in 0..5 {
        let start = (SR as f32 * (0.12 + k as f32 * 0.05)) as usize;
        let len = (SR as f32 * 0.12) as usize;
        let freq = 3200.0 + k as f32 * 420.0;
        for j in 0..len {
            let i = start + j;
            if i >= out.len() {
                break;
            }
            let t = j as f32 / SR as f32;
            let env = (-16.0 * t).exp();
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = ((seed >> 8) as f32 / 16_777_215.0) * 2.0 - 1.0;
            let tone = (2.0 * PI * freq * t).sin();
            out[i] += (tone * 0.6 + noise * 0.4) * env * 0.22;
        }
    }

    write_wav(&path, &out)?;
    Ok(path.to_string_lossy().to_string())
}
