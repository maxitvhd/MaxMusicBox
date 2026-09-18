// MaxMusicBox - Backend nativo Tauri v2 + Rust (áudio rodio + DSP + SQLite + Mercado Pago)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod dsp;
mod library;
mod mp;
mod sfx;

use audio::{AudioCmd, AudioHandle};
use library::{Catalog, FinancialReport, Track, User};
use mp::{MpStatus, PixCharge};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

const DEFAULT_ADMIN_PIN: &str = "1234";
const DEFAULT_PRICE: f64 = 2.50;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AutoDjConfig {
    pub category_locked: bool,
    pub locked_category_id: String,
    pub weekly_schedule: HashMap<String, String>,
    pub date_overrides: HashMap<String, String>,
    pub history_limit: usize,
}

impl Default for AutoDjConfig {
    fn default() -> Self {
        let mut weekly = HashMap::new();
        weekly.insert("0".into(), "samba".into());
        weekly.insert("1".into(), "mpb".into());
        weekly.insert("2".into(), "flashback".into());
        weekly.insert("3".into(), "forro".into());
        weekly.insert("4".into(), "sertanejo".into());
        weekly.insert("5".into(), "rock".into());
        weekly.insert("6".into(), "rock".into());
        Self {
            category_locked: false,
            locked_category_id: String::new(),
            weekly_schedule: weekly,
            date_overrides: HashMap::new(),
            history_limit: 20,
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AudioLevelsPayload {
    left: f32,
    right: f32,
    peak_left: f32,
    peak_right: f32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    position_ms: u64,
    duration_ms: u64,
    playing: bool,
}

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub audio: AudioHandle,
    pub data_dir: PathBuf,
    pub secrets_path: PathBuf,
    pub cache_dir: PathBuf,
    pub sound_path: PathBuf,
    pub library_root: Arc<Mutex<Option<PathBuf>>>,
    pub queue: Arc<Mutex<Vec<Value>>>,
    pub last_category: Arc<Mutex<String>>,
    pub autodj: Arc<Mutex<AutoDjConfig>>,
}

fn load_env_file(path: &PathBuf) {
    if let Ok(content) = std::fs::read_to_string(path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let key = k.trim();
                let val = v.trim().trim_matches('"').trim_matches('\'');
                if std::env::var(key).is_err() {
                    std::env::set_var(key, val);
                }
            }
        }
    }
}

fn detect_default_library() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("MUSICBOX_LIBRARY") {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            return Some(pb);
        }
    }
    let cwd = std::env::current_dir().ok()?;
    let candidates = [
        cwd.join("MUSICAS"),
        cwd.join("../MUSICAS"),
        cwd.join("../../MUSICAS"),
        cwd.join("../../../MUSICAS"),
    ];
    for c in candidates {
        if c.is_dir() && library::count_audio_files(&c) > 0 {
            return Some(c.canonicalize().unwrap_or(c));
        }
    }
    None
}

#[tauri::command]
fn get_catalog(state: State<'_, AppState>) -> Result<Catalog, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::load_catalog(&conn)
}

#[tauri::command]
fn library_info(state: State<'_, AppState>) -> Value {
    let path = state.library_root.lock().ok().and_then(|p| p.clone());
    let count = {
        let conn = state.db.lock().ok();
        conn.and_then(|c| {
            c.query_row("SELECT COUNT(*) FROM tracks", [], |r| r.get::<_, i64>(0))
                .ok()
        })
        .unwrap_or(0)
    };
    json!({
        "path": path.map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        "trackCount": count
    })
}

fn run_scan(state: &AppState) -> Result<usize, String> {
    let root = state
        .library_root
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Nenhuma pasta de músicas definida")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let count = library::scan_library(&conn, &root, &state.cache_dir)?;
    let _ = library::set_setting(&conn, "library_scanned_path", &root.to_string_lossy());
    let _ = library::set_setting(&conn, "library_signature", &library::library_signature(&root));
    Ok(count)
}

#[tauri::command]
fn rescan_library(app: AppHandle, state: State<'_, AppState>) -> Result<usize, String> {
    let count = run_scan(&state)?;
    let _ = app.emit("library_scanned", json!({ "count": count }));
    Ok(count)
}

#[tauri::command]
fn set_library_path(path: String, state: State<'_, AppState>) -> Result<usize, String> {
    let pb = PathBuf::from(&path);
    if !pb.is_dir() {
        return Err("Pasta inválida".to_string());
    }
    *state.library_root.lock().map_err(|e| e.to_string())? = Some(pb.clone());
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        library::set_setting(&conn, "library_path", &pb.to_string_lossy())?;
    }
    run_scan(&state)
}

#[tauri::command]
fn pick_music_folder(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    match folder {
        Some(f) => Ok(f.into_path().ok().map(|p| p.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
fn play_track(id: String, state: State<'_, AppState>) -> Result<Track, String> {
    let track = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        library::get_track(&conn, &id)?
    }
    .ok_or_else(|| format!("Faixa {id} não encontrada"))?;

    state.audio.send(AudioCmd::Play {
        id: track.id.clone(),
        path: track.path.clone(),
        duration_ms: track.duration * 1000,
    });
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = library::record_play(&conn, &track.id);
    }
    if let Ok(mut c) = state.last_category.lock() {
        *c = track.category.clone();
    }
    Ok(track)
}

#[tauri::command]
fn play_track_by_code(code: String, state: State<'_, AppState>) -> Result<Track, String> {
    let track = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        library::get_track_by_code(&conn, &code)?
    }
    .ok_or_else(|| format!("Faixa {code} não encontrada"))?;
    state.audio.send(AudioCmd::Play {
        id: track.id.clone(),
        path: track.path.clone(),
        duration_ms: track.duration * 1000,
    });
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = library::record_play(&conn, &track.id);
    }
    if let Ok(mut c) = state.last_category.lock() {
        *c = track.category.clone();
    }
    Ok(track)
}

#[tauri::command]
fn pause_track(state: State<'_, AppState>) {
    state.audio.send(AudioCmd::Pause);
}

#[tauri::command]
fn resume_track(state: State<'_, AppState>) {
    state.audio.send(AudioCmd::Resume);
}

#[tauri::command]
fn skip_track(state: State<'_, AppState>) {
    state.audio.send(AudioCmd::Stop);
}

#[tauri::command]
fn get_queue(state: State<'_, AppState>) -> Vec<Value> {
    state.queue.lock().map(|q| q.clone()).unwrap_or_default()
}

#[tauri::command]
fn sync_queue(queue: Vec<Value>, state: State<'_, AppState>) {
    if let Ok(mut q) = state.queue.lock() {
        *q = queue;
    }
}

#[tauri::command]
fn auto_dj_next(state: State<'_, AppState>) -> Result<Option<Track>, String> {
    let cfg = state.autodj.lock().map_err(|e| e.to_string())?.clone();
    let recent = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        library::recent_history(&conn, cfg.history_limit)?
    };

    let today = library::today_string();
    let weekday = library::weekday_index().to_string();
    let last_cat = state.last_category.lock().map(|c| c.clone()).unwrap_or_default();

    let target = if cfg.category_locked && !cfg.locked_category_id.is_empty() {
        Some(cfg.locked_category_id.clone())
    } else if let Some(c) = cfg.date_overrides.get(&today) {
        Some(c.clone())
    } else if !last_cat.is_empty() {
        Some(last_cat)
    } else {
        cfg.weekly_schedule.get(&weekday).cloned()
    };

    let track = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        library::random_track(&conn, target.as_deref(), &recent)?
    };

    if let Some(t) = &track {
        state.audio.send(AudioCmd::Play {
            id: t.id.clone(),
            path: t.path.clone(),
            duration_ms: t.duration * 1000,
        });
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = library::record_play(&conn, &t.id);
        drop(conn);
        if let Ok(mut c) = state.last_category.lock() {
            *c = t.category.clone();
        }
    }
    Ok(track)
}

#[tauri::command]
fn set_eq_band(band: usize, gain: f32, state: State<'_, AppState>) {
    state.audio.params.set_eq(band, gain);
}

#[tauri::command]
fn set_compressor(
    threshold: f32,
    ratio: f32,
    attack: Option<f32>,
    release: Option<f32>,
    state: State<'_, AppState>,
) {
    state.audio.params.set_compressor(
        threshold,
        ratio,
        attack.unwrap_or(0.02),
        release.unwrap_or(0.25),
    );
}

#[tauri::command]
fn set_agc(active: bool, sensitivity: Option<f32>, state: State<'_, AppState>) {
    state.audio.params.set_agc(active, sensitivity.unwrap_or(60.0));
}

#[tauri::command]
fn set_limiter_ceiling(ceiling: f32, state: State<'_, AppState>) {
    state.audio.params.set_limiter(ceiling);
}

#[tauri::command]
fn set_master_gain(vol: f32, state: State<'_, AppState>) {
    state.audio.params.set_master(vol);
}

#[tauri::command]
fn log_frontend(msg: String) {
    eprintln!("[frontend] {msg}");
}

#[tauri::command]
fn play_sfx(name: Option<String>, state: State<'_, AppState>) {
    let _ = name;
    state.audio.send(AudioCmd::Sfx {
        path: state.sound_path.to_string_lossy().to_string(),
    });
}

#[tauri::command]
fn get_theme(state: State<'_, AppState>) -> String {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return "neon-vinyl".to_string(),
    };
    library::get_setting(&conn, "theme").unwrap_or_else(|| "neon-vinyl".to_string())
}

#[tauri::command]
fn set_theme(theme: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::set_setting(&conn, "theme", &theme)
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Value {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return json!({}),
    };
    let autodj = state.autodj.lock().map(|c| c.clone()).unwrap_or_default();
    json!({
        "theme": library::get_setting(&conn, "theme").unwrap_or_else(|| "neon-vinyl".into()),
        "pricePerCredit": library::get_setting(&conn, "price_per_credit").and_then(|v| v.parse::<f64>().ok()).unwrap_or(DEFAULT_PRICE),
        "splitPercent": library::get_setting(&conn, "split_percent").and_then(|v| v.parse::<f64>().ok()).unwrap_or(5.0),
        "adminPin": library::get_setting(&conn, "admin_pin").unwrap_or_else(|| DEFAULT_ADMIN_PIN.into()),
        "libraryPath": library::get_setting(&conn, "library_path").unwrap_or_default(),
        "autoDjConfig": autodj,
        "mp": mp::status(&mp::load_secrets(&state.secrets_path))
    })
}

#[tauri::command]
fn set_setting_value(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::set_setting(&conn, &key, &value)
}

#[tauri::command]
fn set_autodj_config(config: AutoDjConfig, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut c) = state.autodj.lock() {
        *c = config.clone();
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    library::set_setting(&conn, "autodj_config", &serialized)
}

#[tauri::command]
fn add_credits(
    amount: f64,
    credits: i64,
    method: Option<String>,
    state: State<'_, AppState>,
) -> Result<FinancialReport, String> {
    let price = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        library::get_setting(&conn, "price_per_credit")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(DEFAULT_PRICE)
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let tx_id = format!("tx-{}", library::now_ms());
    library::insert_finance(
        &conn,
        &tx_id,
        amount,
        credits,
        method.as_deref().unwrap_or("pix"),
    )?;
    library::financial_report(&conn, price)
}

#[tauri::command]
fn get_financial_report(state: State<'_, AppState>) -> Result<FinancialReport, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let price = library::get_setting(&conn, "price_per_credit")
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(DEFAULT_PRICE);
    library::financial_report(&conn, price)
}

#[tauri::command]
fn mp_oauth_start(app: AppHandle, state: State<'_, AppState>) {
    mp::start_oauth(app, state.secrets_path.clone());
}

#[tauri::command]
fn mp_oauth_complete(code: String, app: AppHandle, state: State<'_, AppState>) {
    mp::complete_oauth(app, state.secrets_path.clone(), code);
}

#[tauri::command]
fn mp_oauth_status(state: State<'_, AppState>) -> MpStatus {
    let secrets = mp::load_secrets(&state.secrets_path);
    mp::status(&secrets)
}

#[tauri::command]
fn mp_disconnect(state: State<'_, AppState>) -> Result<(), String> {
    mp::disconnect(&state.secrets_path)
}

#[tauri::command]
fn create_pix_charge(
    amount: f64,
    credits: i64,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PixCharge, String> {
    let result = mp::create_charge(
        app,
        state.db.clone(),
        state.secrets_path.clone(),
        state.audio.clone(),
        state.sound_path.clone(),
        amount,
        credits,
    );
    if let Err(e) = &result {
        eprintln!("[mp] create_pix_charge ERRO: {e}");
    }
    result
}

#[tauri::command]
fn list_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::list_users(&conn)
}

#[tauri::command]
fn create_user(
    name: String,
    password: String,
    credits: i64,
    state: State<'_, AppState>,
) -> Result<User, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::create_user(&conn, &name, &password, credits)
}

#[tauri::command]
fn update_user(
    id: String,
    name: String,
    password: String,
    credits: Option<i64>,
    state: State<'_, AppState>,
) -> Result<User, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::update_user(&conn, &id, &name, &password, credits)
}

#[tauri::command]
fn delete_user(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::delete_user(&conn, &id)
}

#[tauri::command]
fn authenticate_user(password: String, state: State<'_, AppState>) -> Result<Option<User>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::find_user_by_password(&conn, &password)
}

#[tauri::command]
fn deduct_user_credit(id: String, credits: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::deduct_user_credit(&conn, &id, credits)
}

#[tauri::command]
fn add_user_credits(id: String, credits: i64, state: State<'_, AppState>) -> Result<User, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    library::add_user_credits(&conn, &id, credits)
}

fn runtime_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.maxmusicbox.kiosk")
}

/// Diretório "do app": ao lado do executável (produção) ou a raiz do projeto (dev).
fn app_dir() -> Option<PathBuf> {
    let mut dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))?;
    let name = dir
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_string();
    if name == "debug" || name == "release" {
        if let Some(target) = dir.parent() {
            if target.file_name().and_then(|s| s.to_str()) == Some("target") {
                if let Some(proj) = target.parent() {
                    if let Some(root) = proj.parent() {
                        dir = root.to_path_buf();
                    }
                }
            }
        }
    }
    Some(dir)
}

/// Banco operacional em `banco/dados.db` na pasta do app; se não gravável,
/// cai para `app_data_dir/dados.db`.
fn resolve_db_path(env_data_dir: &PathBuf) -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(dir) = app_dir() {
        candidates.push(dir.join("banco/dados.db"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("banco/dados.db"));
    }
    for cand in candidates {
        if let Some(parent) = cand.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                continue;
            }
            let probe = parent.join(".write_test");
            if std::fs::write(&probe, b"ok").is_ok() {
                let _ = std::fs::remove_file(&probe);
                return cand;
            }
        }
    }
    env_data_dir.join("dados.db")
}

/// Copia o banco legado (jukebox.db) para o novo caminho, se ainda não existir.
fn migrate_legacy_db(db_path: &PathBuf, env_data_dir: &PathBuf) {
    if db_path.exists() {
        return;
    }
    let mut legacy: Vec<PathBuf> = vec![env_data_dir.join("jukebox.db")];
    if let Some(dir) = app_dir() {
        legacy.push(dir.join("jukebox.db"));
        legacy.push(dir.join("banco/jukebox.db"));
    }
    for old in legacy {
        if old.exists() && old != *db_path {
            if std::fs::copy(&old, db_path).is_ok() {
                eprintln!("[mmb] banco migrado de {} para {}", old.display(), db_path.display());
            }
            return;
        }
    }
}

fn selftest(args: &[String]) {
    // 1. Diagnóstico do ambiente de runtime (mesma lógica do setup do Tauri)
    let rt_dir = runtime_data_dir();
    let rt_db = resolve_db_path(&rt_dir);
    println!("cwd={:?}", std::env::current_dir());
    println!("detect_default_library={:?}", detect_default_library());
    println!("runtime_data_dir={}", rt_dir.display());
    println!("resolved_db_path={}", rt_db.display());
    if rt_db.exists() {
        if let Ok(conn) = library::open_db(&rt_db) {
            println!(
                "runtime library_path={:?}",
                library::get_setting(&conn, "library_path")
            );
            let n: i64 = conn
                .query_row("SELECT COUNT(*) FROM tracks", [], |r| r.get(0))
                .unwrap_or(0);
            println!("runtime track_count={n}");
            match library::load_catalog(&conn) {
                Ok(c) => println!(
                    "runtime catalog: tracks={} categories={} artists={}",
                    c.tracks.len(),
                    c.categories.len(),
                    c.artists.len()
                ),
                Err(e) => println!("runtime catalog_error={e}"),
            }
        }
    } else {
        println!("runtime DB inexistente (app nunca rodou)");
    }

    // 2. Scan limpo em pasta explícita
    let root = args
        .get(2)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("../MUSICAS"));
    println!("root={}", root.display());
    println!("is_dir={}", root.is_dir());
    println!("audio_files={}", library::count_audio_files(&root));

    let db_path = std::env::temp_dir().join("mmb_selftest.db");
    let _ = std::fs::remove_file(&db_path);
    let db = library::open_db(&db_path).expect("abrir db selftest");
    let cache = std::env::temp_dir().join("mmb_selftest_covers");
    match library::scan_library(&db, &root, &cache) {
        Ok(n) => println!("scanned={n}"),
        Err(e) => println!("scan_error={e}"),
    }
    match library::load_catalog(&db) {
        Ok(c) => {
            println!(
                "tracks={} categories={} artists={}",
                c.tracks.len(),
                c.categories.len(),
                c.artists.len()
            );
            for t in c.tracks.iter().take(8) {
                println!(" - [{}] {} - {} (cat={})", t.code, t.artist, t.title, t.category);
            }
        }
        Err(e) => println!("catalog_error={e}"),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--selftest") {
        selftest(&args);
        return;
    }

    // Carrega .env (dev/produção) de locais comuns.
    // Prioridade: env do processo já definido vence; entre arquivos, o primeiro muda o valor.
    if let Some(home) = std::env::var_os("HOME") {
        load_env_file(&PathBuf::from(home).join(".config/maxmusicbox/.env"));
    }
    if let Some(snap) = std::env::var_os("SNAP") {
        load_env_file(&PathBuf::from(snap).join("share/maxmusicbox/.env"));
    }
    if let Some(dir) = app_dir() {
        load_env_file(&dir.join(".env"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        load_env_file(&cwd.join(".env"));
        load_env_file(&cwd.join("../.env"));
        load_env_file(&cwd.join("src-tauri/.env"));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            std::fs::create_dir_all(&data_dir).ok();
            let cache_dir = data_dir.join("covers");
            std::fs::create_dir_all(&cache_dir).ok();

            // Banco de dados operacional: banco/dados.db na pasta do app (fallback: app_data_dir)
            let db_path = resolve_db_path(&data_dir);
            migrate_legacy_db(&db_path, &data_dir);
            eprintln!("[mmb] db_path={}", db_path.display());
            let db = library::open_db(&db_path).expect("Falha ao abrir o banco SQLite");

            // Segredos (OAuth do vendedor) ficam FORA do banco.
            let secrets_path = data_dir.join("secrets.json");
            // Migra eventuais tokens que ficaram no banco (versões antigas) e limpa resíduos.
            let residue = mp::load_secrets(&secrets_path);
            if residue.mp_access_token.is_none() {
                if let Some(tok) = library::get_setting(&db, "mp_access_token") {
                    if !tok.is_empty() {
                        let migrated = mp::Secrets {
                            mp_access_token: Some(tok),
                            mp_refresh_token: library::get_setting(&db, "mp_refresh_token"),
                            mp_expires_at: library::get_setting(&db, "mp_expires_at")
                                .and_then(|v| v.parse().ok()),
                            mp_user_id: library::get_setting(&db, "mp_user_id"),
                            mp_pkce_verifier: None,
                        };
                        let _ = mp::save_secrets(&secrets_path, &migrated);
                    }
                }
            }
            for k in ["mp_access_token", "mp_refresh_token", "mp_expires_at", "mp_user_id"] {
                let _ = db.execute("DELETE FROM settings WHERE key = ?1", rusqlite::params![k]);
            }
            eprintln!("[mmb] secrets_path={}", secrets_path.display());

            // Som da caixa registradora
            let sound_path = sfx::ensure_cash_sound(&data_dir.join("sfx"))
                .map(PathBuf::from)
                .unwrap_or_else(|_| data_dir.join("sfx/caixa_retro.wav"));

            // Biblioteca padrão
            let stored = library::get_setting(&db, "library_path");
            let default_lib = stored
                .clone()
                .map(PathBuf::from)
                .filter(|p| p.is_dir())
                .or_else(detect_default_library);
            if let Some(lib) = &default_lib {
                library::set_setting(&db, "library_path", &lib.to_string_lossy()).ok();
            }

            let autodj = library::get_setting(&db, "autodj_config")
                .and_then(|s| serde_json::from_str::<AutoDjConfig>(&s).ok())
                .unwrap_or_default();

            // Escaneia na inicialização (se a pasta mudou ou banco vazio)
            let has_tracks: i64 = db
                .query_row("SELECT COUNT(*) FROM tracks", [], |r| r.get(0))
                .unwrap_or(0);
            let mut scanned_count = 0usize;
            if let Some(lib) = &default_lib {
                let cached = library::get_setting(&db, "library_scanned_path");
                let signature = library::library_signature(lib);
                let cached_sig = library::get_setting(&db, "library_signature");
                if has_tracks == 0
                    || cached.as_deref() != Some(&lib.to_string_lossy())
                    || cached_sig.as_deref() != Some(signature.as_str())
                {
                    if let Ok(count) = library::scan_library(&db, lib, &cache_dir) {
                        scanned_count = count;
                        let _ = library::set_setting(
                            &db,
                            "library_scanned_path",
                            &lib.to_string_lossy(),
                        );
                        let _ = library::set_setting(&db, "library_signature", &signature);
                    }
                }
            }
            eprintln!("[mmb] startup scan: lib={:?} tracks={has_tracks} scanned={scanned_count}", default_lib);

            let audio = audio::spawn_audio();

            let state = AppState {
                db: Arc::new(Mutex::new(db)),
                audio: audio.clone(),
                data_dir: data_dir.clone(),
                secrets_path: secrets_path.clone(),
                cache_dir: cache_dir.clone(),
                sound_path,
                library_root: Arc::new(Mutex::new(default_lib)),
                queue: Arc::new(Mutex::new(Vec::new())),
                last_category: Arc::new(Mutex::new(String::new())),
                autodj: Arc::new(Mutex::new(autodj)),
            };
            app.manage(state);

            // Thread emissora de eventos (60 fps)
            let handle = app.handle().clone();
            let meters = audio.meters.clone();
            let current = audio.current.clone();
            std::thread::spawn(move || {
                let mut pos_hist: Vec<f32> = vec![0.0; 16];
                let mut ticks: u64 = 0;
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(16));
                    let (l, r) = meters.get_rms();
                    let (pl, pr) = meters.get_peaks();
                    ticks += 1;
                    if ticks % 120 == 0 {
                        let spec = meters.get_spectrum();
                        let peak_band = spec.iter().cloned().fold(0.0f32, f32::max);
                        eprintln!(
                            "[mmb] levels rms=({l:.3},{r:.3}) peak=({pl:.3},{pr:.3}) spec_max={peak_band:.3}"
                        );
                    }
                    let _ = handle.emit(
                        "audio_levels",
                        AudioLevelsPayload {
                            left: l,
                            right: r,
                            peak_left: pl,
                            peak_right: pr,
                        },
                    );

                    let spec = meters.get_spectrum();
                    for (i, v) in spec.iter().enumerate() {
                        let prev = pos_hist[i];
                        pos_hist[i] = if *v > prev {
                            *v
                        } else {
                            prev * 0.82 + *v * 0.18
                        };
                    }
                    let _ = handle.emit("audio_spectrum", pos_hist.clone());

                    let (duration_ms, playing) = current
                        .lock()
                        .ok()
                        .and_then(|c| c.as_ref().map(|i| (i.duration_ms, true)))
                        .unwrap_or((0, false));
                    let sr = meters.sample_rate.load(Ordering::Relaxed).max(1) as u64;
                    let frames = meters.position_frames.load(Ordering::Relaxed);
                    let position_ms = frames.saturating_mul(1000) / sr;
                    let _ = handle.emit(
                        "playback_progress",
                        ProgressPayload {
                            position_ms,
                            duration_ms,
                            playing,
                        },
                    );

                    if meters.ended.swap(false, Ordering::SeqCst) {
                        let _ = handle.emit("track_ended", json!({}));
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            library_info,
            rescan_library,
            set_library_path,
            pick_music_folder,
            play_track,
            play_track_by_code,
            pause_track,
            resume_track,
            skip_track,
            get_queue,
            sync_queue,
            auto_dj_next,
            set_eq_band,
            set_compressor,
            set_agc,
            set_limiter_ceiling,
            set_master_gain,
            play_sfx,
            log_frontend,
            get_theme,
            set_theme,
            get_settings,
            set_setting_value,
            set_autodj_config,
            add_credits,
            get_financial_report,
            mp_oauth_start,
            mp_oauth_complete,
            mp_oauth_status,
            mp_disconnect,
            create_pix_charge,
            list_users,
            create_user,
            update_user,
            delete_user,
            authenticate_user,
            deduct_user_credit,
            add_user_credits,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar MaxMusicBox");
}
