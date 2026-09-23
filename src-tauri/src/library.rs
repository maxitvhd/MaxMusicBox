// Biblioteca: varredura recursiva, metadados (lofty), capas e persistência SQLite
use base64::Engine;
use lofty::prelude::*;
use rand::Rng;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use walkdir::WalkDir;

static ART_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn art_cache() -> &'static Mutex<HashMap<String, String>> {
    ART_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Converte o arquivo de capa em data URI (com cache em memória).
fn resolve_art(id: &str, path: &str) -> String {
    if path.is_empty() {
        return String::new();
    }
    if let Ok(cache) = art_cache().lock() {
        if let Some(v) = cache.get(id) {
            return v.clone();
        }
    }
    let result = match fs::read(path) {
        Ok(bytes) => {
            let mime = if path.ends_with(".png") {
                "image/png"
            } else {
                "image/jpeg"
            };
            let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
            format!("data:{mime};base64,{b64}")
        }
        Err(_) => String::new(),
    };
    if let Ok(mut cache) = art_cache().lock() {
        cache.insert(id.to_string(), result.clone());
    }
    result
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub code: String,
    pub title: String,
    pub artist: String,
    pub artist_id: String,
    pub category: String,
    pub duration: u64,
    pub cost: i64,
    pub album_art: String,
    pub genre: String,
    pub bpm: u32,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub code: String,
    pub name: String,
    pub icon_name: String,
    pub cover_image: String,
    pub color: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category_id: String,
    pub avatar: String,
    pub bio: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub categories: Vec<Category>,
    pub artists: Vec<Artist>,
    pub tracks: Vec<Track>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FinancialTransaction {
    pub id: String,
    pub timestamp: i64,
    pub amount: f64,
    pub credits: i64,
    pub payment_method: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FinancialReport {
    pub price_per_credit: f64,
    pub total_credits_inserted: i64,
    pub daily_revenue: f64,
    pub daily_credits: i64,
    pub monthly_revenue: f64,
    pub monthly_credits: i64,
    pub history: Vec<FinancialTransaction>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub name: String,
    pub credits: i64,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeductResult {
    pub success: bool,
    pub remaining: i64,
    pub expired: bool,
}

pub fn open_db(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    init_schema(&conn)?;
    Ok(conn)
}

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            code TEXT,
            title TEXT,
            artist TEXT,
            artist_id TEXT,
            category TEXT,
            file_path TEXT,
            duration INTEGER,
            album_art TEXT,
            genre TEXT,
            bpm INTEGER,
            cost INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS finance_log (
            id TEXT PRIMARY KEY,
            timestamp INTEGER,
            amount REAL,
            credits INTEGER,
            method TEXT
        );
        CREATE TABLE IF NOT EXISTS play_history (
            track_id TEXT PRIMARY KEY,
            played_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS pix_charges (
            id TEXT PRIMARY KEY,
            amount REAL,
            credits INTEGER,
            status TEXT,
            created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            password_hash TEXT,
            credits INTEGER DEFAULT 0,
            created_at INTEGER
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    let digest = hasher.finalize();
    format!("{salt}${}", hex_encode(&digest))
}

pub fn verify_password(stored: &str, password: &str) -> bool {
    if let Some((salt, hex)) = stored.split_once('$') {
        let mut hasher = Sha256::new();
        hasher.update(salt.as_bytes());
        hasher.update(password.as_bytes());
        let digest = hasher.finalize();
        return hex_encode(&digest).as_bytes() == hex.as_bytes();
    }
    false
}

fn random_salt() -> String {
    let bytes: [u8; 16] = rand::thread_rng().gen();
    hex_encode(&bytes)
}

pub fn list_users(conn: &Connection) -> Result<Vec<User>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, credits, created_at FROM users ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                credits: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn get_user(conn: &Connection, id: &str) -> Result<Option<User>, String> {
    match conn.query_row(
        "SELECT id, name, credits, created_at FROM users WHERE id = ?1",
        params![id],
        |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                credits: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    ) {
        Ok(u) => Ok(Some(u)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn user_password_hash(conn: &Connection, id: &str) -> Option<String> {
    conn.query_row(
        "SELECT password_hash FROM users WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
    .ok()
}

pub fn find_user_by_password(conn: &Connection, password: &str) -> Result<Option<User>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, password_hash, credits, created_at FROM users")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (id, name, hash, credits, created_at) = row.map_err(|e| e.to_string())?;
        if verify_password(&hash, password) {
            return Ok(Some(User {
                id,
                name,
                credits,
                created_at,
            }));
        }
    }
    Ok(None)
}

fn user_name_exists(conn: &Connection, name: &str, exclude_id: Option<&str>) -> Result<bool, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Informe o nome do usuário".to_string());
    }
    let count: i64 = match exclude_id {
        Some(id) => conn
            .query_row(
                "SELECT COUNT(*) FROM users WHERE name = ?1 COLLATE NOCASE AND id <> ?2",
                params![name, id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?,
        None => conn
            .query_row(
                "SELECT COUNT(*) FROM users WHERE name = ?1 COLLATE NOCASE",
                params![name],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?,
    };
    Ok(count > 0)
}

pub fn create_user(conn: &Connection, name: &str, password: &str, credits: i64) -> Result<User, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Informe o nome do usuário".to_string());
    }
    if password.is_empty() {
        return Err("Informe uma senha para o usuário".to_string());
    }
    if user_name_exists(conn, name, None)? {
        return Err("Já existe um usuário com esse nome".to_string());
    }
    if find_user_by_password(conn, password)?.is_some() {
        return Err("Essa senha já está em uso por outro usuário".to_string());
    }
    let id = format!("usr-{}", now_ms());
    let hash = hash_password(password, &random_salt());
    conn.execute(
        "INSERT INTO users (id, name, password_hash, credits, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, hash, credits.max(0), now_ms()],
    )
    .map_err(|e| e.to_string())?;
    get_user(conn, &id)?.ok_or("Falha ao criar o usuário".to_string())
}

pub fn update_user(
    conn: &Connection,
    id: &str,
    name: &str,
    password: &str,
    credits: Option<i64>,
) -> Result<User, String> {
    let existing = get_user(conn, id)?.ok_or("Usuário não encontrado".to_string())?;
    let new_name = name.trim();
    if !new_name.is_empty() && new_name.to_lowercase() != existing.name.to_lowercase() {
        if user_name_exists(conn, new_name, Some(id))? {
            return Err("Já existe um usuário com esse nome".to_string());
        }
    }
    let mut new_hash: Option<String> = None;
    if !password.is_empty() {
        if let Some(other) = find_user_by_password(conn, password)? {
            if other.id != id {
                return Err("Essa senha já está em uso por outro usuário".to_string());
            }
        }
        new_hash = Some(hash_password(password, &random_salt()));
    }
    let final_name = if new_name.is_empty() {
        existing.name.clone()
    } else {
        new_name.to_string()
    };
    let final_hash = new_hash.unwrap_or_else(|| user_password_hash(conn, id).unwrap_or_default());
    let final_credits = credits.unwrap_or(existing.credits).max(0);
    conn.execute(
        "UPDATE users SET name = ?1, password_hash = ?2, credits = ?3 WHERE id = ?4",
        params![final_name, final_hash, final_credits, id],
    )
    .map_err(|e| e.to_string())?;
    get_user(conn, id)?.ok_or("Usuário não encontrado após atualização".to_string())
}

pub fn delete_user(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM users WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Calcula a quantidade de créditos com base no valor em R$ e preço unitário configurado
pub fn calculate_credits_for_amount(conn: &Connection, amount: f64) -> i64 {
    let price_per_credit: f64 = get_setting(conn, "price_per_credit")
        .and_then(|v| v.parse::<f64>().ok())
        .filter(|&v| v > 0.0)
        .unwrap_or(2.50);

    if price_per_credit <= 0.0 {
        return 0;
    }
    (amount / price_per_credit).floor() as i64
}

/// Cria ou recarrega um usuário temporário baseado no código PIN de 5 dígitos
pub fn create_or_topup_temp_user(conn: &Connection, pin: &str, credits: i64) -> Result<User, String> {
    let pin = pin.trim();
    let temp_id = format!("temp-{}", pin);
    let temp_name = format!("Cliente #{}", pin);

    if let Some(_existing) = get_user(conn, &temp_id)? {
        return add_user_credits(conn, &temp_id, credits);
    }

    let hash = hash_password(pin, &random_salt());
    conn.execute(
        "INSERT INTO users (id, name, password_hash, credits, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![temp_id, temp_name, hash, credits.max(0), now_ms()],
    )
    .map_err(|e| e.to_string())?;

    get_user(conn, &temp_id)?.ok_or("Falha ao criar o usuário temporário".to_string())
}

pub fn deduct_user_credit(conn: &Connection, id: &str, credits: i64) -> Result<DeductResult, String> {
    let affected = conn
        .execute(
            "UPDATE users SET credits = credits - ?1 WHERE id = ?2 AND credits >= ?1",
            params![credits, id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Ok(DeductResult {
            success: false,
            remaining: 0,
            expired: false,
        });
    }

    let remaining: i64 = conn
        .query_row("SELECT credits FROM users WHERE id = ?1", params![id], |r| r.get(0))
        .unwrap_or(0);

    // Se for usuário temporário (prefixo temp-) e o saldo zerou, exclui automaticamente do SQLite
    if id.starts_with("temp-") && remaining <= 0 {
        let _ = conn.execute("DELETE FROM users WHERE id = ?1", params![id]);
        return Ok(DeductResult {
            success: true,
            remaining: 0,
            expired: true,
        });
    }

    Ok(DeductResult {
        success: true,
        remaining,
        expired: false,
    })
}

pub fn add_user_credits(conn: &Connection, id: &str, credits: i64) -> Result<User, String> {
    conn.execute(
        "UPDATE users SET credits = credits + ?1 WHERE id = ?2",
        params![credits, id],
    )
    .map_err(|e| e.to_string())?;
    get_user(conn, id)?.ok_or("Usuário não encontrado".to_string())
}

fn fnv1a(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn slug(s: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for c in s.chars() {
        if c.is_alphanumeric() {
            for lc in c.to_lowercase() {
                out.push(lc);
            }
            last_dash = false;
        } else if !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        "geral".to_string()
    } else {
        out
    }
}

fn titlecase(s: &str) -> String {
    s.split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => {
                    first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase()
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

const AUDIO_EXTS: [&str; 6] = ["mp3", "wav", "flac", "ogg", "m4a", "aac"];

pub fn count_audio_files(root: &Path) -> usize {
    WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| AUDIO_EXTS.contains(&x.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .count()
}

/// Assinatura do estado da biblioteca (caminhos + mtime). Muda quando arquivos
/// são adicionados, removidos ou movidos de pasta — dispara rescan automático.
pub fn library_signature(root: &Path) -> String {
    let mut entries: Vec<(String, i64)> = WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| AUDIO_EXTS.contains(&x.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|e| {
            let p = e.path().to_string_lossy().to_string();
            let mtime = e
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            (p, mtime)
        })
        .collect();
    entries.sort();
    let mut acc: u64 = 0xcbf29ce484222325;
    for (p, m) in &entries {
        acc ^= fnv1a(p) as u64;
        acc = acc.wrapping_mul(0x100000001b3);
        acc ^= *m as u64;
        acc = acc.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}:{}", acc, entries.len())
}

struct Meta {
    title: String,
    artist: String,
    genre: String,
    duration: u64,
    cover_path: String,
}

fn read_meta(path: &Path, cache_dir: &Path, id: &str, fallback_name: &str) -> Meta {
    let mut meta = Meta {
        title: fallback_name.to_string(),
        artist: "Desconhecido".to_string(),
        genre: String::new(),
        duration: 0,
        cover_path: String::new(),
    };

    if let Ok(tagged) = lofty::probe::Probe::open(path).and_then(|p| p.read()) {
        meta.duration = tagged.properties().duration().as_secs();
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(t) = tag.title() {
                if !t.trim().is_empty() {
                    meta.title = t.trim().to_string();
                }
            }
            if let Some(a) = tag.artist() {
                if !a.trim().is_empty() {
                    meta.artist = a.trim().to_string();
                }
            }
            if let Some(g) = tag.genre() {
                meta.genre = g.trim().to_string();
            }
            if let Some(pic) = tag.pictures().first() {
                let ext = match pic.mime_type() {
                    Some(m) if m.as_str().contains("png") => "png",
                    _ => "jpg",
                };
                let out = cache_dir.join(format!("{id}.{ext}"));
                if fs::write(&out, pic.data()).is_ok() {
                    meta.cover_path = out.to_string_lossy().to_string();
                }
            }
        }
    }
    meta
}

pub fn scan_library(conn: &Connection, root: &Path, cache_dir: &Path) -> Result<usize, String> {
    fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;

    let mut files: Vec<PathBuf> = WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| AUDIO_EXTS.contains(&x.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect();

    files.sort();
    files.dedup();

    conn.execute("DELETE FROM tracks", [])
        .map_err(|e| e.to_string())?;

    let palette = [
        "#06b6d4", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#eab308",
    ];

    let mut inserted = 0usize;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    for (idx, file) in files.iter().enumerate() {
        let path_str = file.to_string_lossy().to_string();
        let id = format!("{:016x}", fnv1a(&path_str));
        let code = format!("{:02}", idx + 1);
        let file_stem = file
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Faixa")
            .to_string();

        let mut fallback_title = titlecase(&file_stem);
        let mut fallback_artist = String::from("Desconhecido");
        if let Some((a, t)) = file_stem.split_once(" - ") {
            fallback_artist = titlecase(a);
            fallback_title = titlecase(t);
        }

        let mut meta = read_meta(file, cache_dir, &id, &fallback_title);
        if meta.artist == "Desconhecido" {
            meta.artist = fallback_artist.to_string();
        }

        // Categoria: subpasta (relativa à raiz) > gênero da tag > "Geral"
        let rel = file.strip_prefix(root).unwrap_or(file);
        let parent = rel.parent();
        let category = match parent {
            Some(p) if !p.as_os_str().is_empty() => {
                titlecase(&p.file_name().and_then(|s| s.to_str()).unwrap_or("Geral"))
            }
            _ => {
                if meta.genre.trim().is_empty() {
                    "Geral".to_string()
                } else {
                    titlecase(&meta.genre)
                }
            }
        };

        let artist_id = slug(&meta.artist);
        let category_id = slug(&category);

        tx.execute(
            "INSERT INTO tracks (id, code, title, artist, artist_id, category, file_path, duration, album_art, genre, bpm, cost)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                id,
                code,
                meta.title,
                meta.artist,
                artist_id,
                category_id,
                path_str,
                meta.duration as i64,
                meta.cover_path,
                meta.genre,
                0i64,
                1i64
            ],
        )
        .map_err(|e| e.to_string())?;

        inserted += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;

    // Reconstrói categorias/artistas nas settings para consulta rápida
    let _ = palette;
    Ok(inserted)
}

fn row_to_track(row: &rusqlite::Row) -> rusqlite::Result<Track> {
    Ok(Track {
        id: row.get(0)?,
        code: row.get(1)?,
        title: row.get(2)?,
        artist: row.get(3)?,
        artist_id: row.get(4)?,
        category: row.get(5)?,
        duration: row.get::<_, i64>(6)? as u64,
        album_art: row.get(7)?,
        genre: row.get(8)?,
        bpm: row.get::<_, i64>(9)? as u32,
        path: row.get(10)?,
        cost: row.get(11)?,
    })
}

pub fn all_tracks(conn: &Connection) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, code, title, artist, artist_id, category, duration, album_art, genre, bpm, file_path, cost
             FROM tracks ORDER BY code",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_track)
        .map_err(|e| e.to_string())?;
    let mut tracks = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    for t in &mut tracks {
        if !t.album_art.is_empty() {
            t.album_art = resolve_art(&t.id, &t.album_art);
        }
    }
    Ok(tracks)
}

pub fn get_track(conn: &Connection, id: &str) -> Result<Option<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, code, title, artist, artist_id, category, duration, album_art, genre, bpm, file_path, cost
             FROM tracks WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![id], row_to_track).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(mut t)) => {
            if !t.album_art.is_empty() {
                t.album_art = resolve_art(&t.id, &t.album_art);
            }
            Ok(Some(t))
        }
        _ => Ok(None),
    }
}

pub fn get_track_by_code(conn: &Connection, code: &str) -> Result<Option<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, code, title, artist, artist_id, category, duration, album_art, genre, bpm, file_path, cost
             FROM tracks WHERE code = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![code], row_to_track).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(mut t)) => {
            if !t.album_art.is_empty() {
                t.album_art = resolve_art(&t.id, &t.album_art);
            }
            Ok(Some(t))
        }
        _ => Ok(None),
    }
}

pub fn load_catalog(conn: &Connection) -> Result<Catalog, String> {
    let tracks = all_tracks(conn)?;

    let palette = [
        "#06b6d4", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#eab308",
    ];
    let icons = ["Music", "Disc3", "Radio", "Mic2", "Guitar", "Drum", "Piano", "Star"];

    let mut categories: Vec<Category> = Vec::new();
    let mut artists: Vec<Artist> = Vec::new();
    let mut seen_cat: Vec<String> = Vec::new();
    let mut seen_art: Vec<String> = Vec::new();

    for t in &tracks {
        if !seen_cat.contains(&t.category) {
            seen_cat.push(t.category.clone());
            let idx = seen_cat.len() - 1;
            let name = titlecase(&t.category.replace('-', " "));
            let cover = t.album_art.clone();
            categories.push(Category {
                id: t.category.clone(),
                code: format!("{:02}", idx + 1),
                name,
                icon_name: icons[idx % icons.len()].to_string(),
                cover_image: cover,
                color: palette[idx % palette.len()].to_string(),
                description: String::new(),
            });
        }
        if !seen_art.contains(&t.artist_id) {
            seen_art.push(t.artist_id.clone());
            let idx = seen_art.len() - 1;
            artists.push(Artist {
                id: t.artist_id.clone(),
                code: format!("{:02}", idx + 1),
                name: t.artist.clone(),
                category_id: t.category.clone(),
                avatar: t.album_art.clone(),
                bio: String::new(),
            });
        }
    }

    Ok(Catalog {
        categories,
        artists,
        tracks,
    })
}

pub fn random_track(
    conn: &Connection,
    category_filter: Option<&str>,
    exclude: &[String],
) -> Result<Option<Track>, String> {
    let all = all_tracks(conn)?;
    if all.is_empty() {
        return Ok(None);
    }
    let pool: Vec<&Track> = all
        .iter()
        .filter(|t| category_filter.map(|c| t.category == c).unwrap_or(true))
        .filter(|t| !exclude.contains(&t.id))
        .collect();

    let chosen = if pool.is_empty() {
        let relaxed: Vec<&Track> = all
            .iter()
            .filter(|t| category_filter.map(|c| t.category == c).unwrap_or(true))
            .collect();
        if relaxed.is_empty() {
            all.get(rand_index(all.len()))
        } else {
            relaxed.get(rand_index(relaxed.len())).copied()
        }
    } else {
        pool.get(rand_index(pool.len())).copied()
    };

    Ok(chosen.cloned())
}

fn rand_index(len: usize) -> usize {
    use rand::Rng;
    if len == 0 {
        0
    } else {
        rand::thread_rng().gen_range(0..len)
    }
}

pub fn record_play(conn: &Connection, track_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO play_history (track_id, played_at) VALUES (?1, ?2)
         ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at",
        params![track_id, now_ms()],
    )
    .map_err(|e| e.to_string())?;
    // mantém apenas as últimas 20 entradas
    conn.execute(
        "DELETE FROM play_history WHERE track_id NOT IN (
            SELECT track_id FROM play_history ORDER BY played_at DESC LIMIT 20
         )",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn recent_history(conn: &Connection, limit: usize) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT track_id FROM play_history ORDER BY played_at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit as i64], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn insert_finance(
    conn: &Connection,
    id: &str,
    amount: f64,
    credits: i64,
    method: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO finance_log (id, timestamp, amount, credits, method) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, now_ms(), amount, credits, method],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn financial_report(conn: &Connection, price_per_credit: f64) -> Result<FinancialReport, String> {
    use chrono::{Datelike, Local, TimeZone};
    let now_dt = Local::now();
    let day_start = Local
        .with_ymd_and_hms(now_dt.year(), now_dt.month(), now_dt.day(), 0, 0, 0)
        .single()
        .map(|d| d.timestamp_millis())
        .unwrap_or(now_ms());
    let month_start = Local
        .with_ymd_and_hms(now_dt.year(), now_dt.month(), 1, 0, 0, 0)
        .single()
        .map(|d| d.timestamp_millis())
        .unwrap_or(now_ms());
    let d = month_start;

    let total_credits: i64 = conn
        .query_row("SELECT COALESCE(SUM(credits),0) FROM finance_log", [], |r| r.get(0))
        .unwrap_or(0);
    let (daily_revenue, daily_credits): (f64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0), COALESCE(SUM(credits),0) FROM finance_log WHERE timestamp >= ?1",
            params![day_start],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0));
    let (monthly_revenue, monthly_credits): (f64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0), COALESCE(SUM(credits),0) FROM finance_log WHERE timestamp >= ?1",
            params![d],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0));

    let mut stmt = conn
        .prepare("SELECT id, timestamp, amount, credits, method FROM finance_log ORDER BY timestamp DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let history = stmt
        .query_map([], |r| {
            Ok(FinancialTransaction {
                id: r.get(0)?,
                timestamp: r.get(1)?,
                amount: r.get(2)?,
                credits: r.get(3)?,
                payment_method: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(FinancialReport {
        price_per_credit,
        total_credits_inserted: total_credits,
        daily_revenue,
        daily_credits,
        monthly_revenue,
        monthly_credits,
        history,
    })
}

pub fn today_string() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub fn weekday_index() -> u32 {
    // 0 = Domingo ... 6 = Sábado
    use chrono::Datelike;
    chrono::Local::now().weekday().num_days_from_sunday()
}
