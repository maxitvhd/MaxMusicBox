// Integração Mercado Pago (marketplace): OAuth, cobrança Pix com split e polling de confirmação.
use crate::audio::{AudioCmd, AudioHandle};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

const TOKEN_URL: &str = "https://api.mercadopago.com/oauth/token";
const PAYMENTS_URL: &str = "https://api.mercadopago.com/v1/payments";

#[derive(Clone)]
pub struct MpConfig {
    pub client_id: String,
    pub client_secret: String,
    /// Access Token fixo (Pix direto na conta, sem OAuth/marketplace).
    pub access_token: Option<String>,
    pub redirect_uri: String,
    pub auth_url: String,
    pub payer_email: String,
    pub split_percent: f64,
}

impl MpConfig {
    /// Marketplace (OAuth) quando há Client ID + Secret; caso contrário é
    /// apenas um Access Token fixo (sem split).
    pub fn is_marketplace(&self) -> bool {
        !self.client_id.trim().is_empty() && !self.client_secret.trim().is_empty()
    }
}

pub fn config_from_env() -> Option<MpConfig> {
    let client_id = std::env::var("MP_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("MP_CLIENT_SECRET").unwrap_or_default();
    let access_token = std::env::var("MP_ACCESS_TOKEN")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    let has_oauth = !client_id.trim().is_empty() && !client_secret.trim().is_empty();
    if !has_oauth && access_token.is_none() {
        return None;
    }

    Some(MpConfig {
        client_id,
        client_secret,
        access_token,
        redirect_uri: std::env::var("MP_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:8799/callback".to_string()),
        auth_url: std::env::var("MP_AUTH_URL")
            .unwrap_or_else(|_| "https://auth.mercadopago.com/authorization".to_string()),
        payer_email: std::env::var("MP_PAYER_EMAIL")
            .unwrap_or_else(|_| "cliente@maxmusicbox.app".to_string()),
        split_percent: std::env::var("MP_SPLIT_PERCENT")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(5.0),
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MpStatus {
    pub configured: bool,
    pub connected: bool,
    pub collector_id: Option<String>,
    pub expires_at: Option<i64>,
    pub split_percent: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PixCharge {
    pub tx_id: String,
    pub payment_id: String,
    pub qr_base64: String,
    pub copy_paste: String,
    pub expires_at: i64,
    pub amount: f64,
    pub credits: i64,
}

/// Dados sensíveis do vendedor (OAuth). Guardados FORA do banco, em
/// `secrets.json` com permissão restrita — nunca na tabela `settings`.
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
pub struct Secrets {
    pub mp_access_token: Option<String>,
    pub mp_refresh_token: Option<String>,
    pub mp_expires_at: Option<i64>,
    pub mp_user_id: Option<String>,
    /// `code_verifier` do PKCE gerado em `start_oauth` e consumido na troca.
    #[serde(default)]
    pub mp_pkce_verifier: Option<String>,
}

pub fn load_secrets(path: &PathBuf) -> Secrets {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Secrets>(&s).ok())
        .unwrap_or_default()
}

pub fn save_secrets(path: &PathBuf, s: &Secrets) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub fn status(secrets: &Secrets) -> MpStatus {
    let cfg = config_from_env();
    let oauth_token = secrets
        .mp_access_token
        .as_ref()
        .map(|t| !t.is_empty())
        .unwrap_or(false);
    let env_token = cfg
        .as_ref()
        .and_then(|c| c.access_token.as_ref())
        .map(|t| !t.is_empty())
        .unwrap_or(false);
    let split = cfg
        .as_ref()
        .filter(|c| c.is_marketplace())
        .map(|c| c.split_percent)
        .unwrap_or(0.0);
    MpStatus {
        configured: cfg.is_some(),
        connected: oauth_token || env_token,
        collector_id: secrets.mp_user_id.clone().filter(|v| !v.is_empty()),
        expires_at: secrets.mp_expires_at,
        split_percent: split,
    }
}

pub fn disconnect(path: &PathBuf) -> Result<(), String> {
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Gera o `code_verifier` do PKCE (43 chars URL-safe, sem padding).
fn pkce_verifier() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// `code_challenge` = base64url(SHA-256(code_verifier)).
fn pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn build_auth_url(cfg: &MpConfig, challenge: &str) -> String {
    format!(
        "{}?response_type=code&client_id={}&platform_id=mp&redirect_uri={}&state=maxmusicbox&code_challenge={}&code_challenge_method=S256",
        cfg.auth_url,
        urlencoding::encode(&cfg.client_id),
        urlencoding::encode(&cfg.redirect_uri),
        urlencoding::encode(challenge)
    )
}

/// Extrai a porta do redirect_uri quando ele aponta para localhost.
fn redirect_port(redirect_uri: &str) -> u16 {
    redirect_uri
        .rsplit(':')
        .next()
        .and_then(|s| s.split('/').next())
        .and_then(|s| s.parse().ok())
        .unwrap_or(8799)
}

/// Redirect local (loopback) captura o `code` automaticamente; remoto exige colar.
fn is_local_redirect(redirect_uri: &str) -> bool {
    let r = redirect_uri.to_ascii_lowercase();
    r.contains("localhost") || r.contains("127.0.0.1")
}

/// Aceita tanto o `code` puro quanto a URL completa de callback colada.
fn extract_code(input: &str) -> String {
    let s = input.trim();
    if let Some(idx) = s.find("code=") {
        return s[idx + 5..]
            .split('&')
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
    }
    s.to_string()
}

fn save_token(path: &PathBuf, token: &TokenResponse) -> Result<Secrets, String> {
    let mut s = load_secrets(path);
    s.mp_access_token = Some(token.access_token.clone());
    s.mp_refresh_token = token.refresh_token.clone();
    s.mp_expires_at =
        Some(now_ms() + (token.expires_in.unwrap_or(3600) as i64) * 1000 - 60_000);
    s.mp_user_id = token.user_id.map(|v| v.to_string());
    eprintln!(
        "[mp] vendedor conectado user_id={} (confirme que é DIFERENTE da conta dona da aplicação)",
        s.mp_user_id.as_deref().unwrap_or("?")
    );
    save_secrets(path, &s)?;
    Ok(s)
}

/// Troca o `code` recebido no callback pelo Access Token do vendedor e salva (fora do banco).
pub fn complete_oauth(app: AppHandle, secrets_path: PathBuf, code: String) {
    let cfg = match config_from_env() {
        Some(c) => c,
        None => {
            let _ = app.emit("mp_error", "Credenciais do Mercado Pago ausentes.");
            return;
        }
    };
    let code = extract_code(&code);
    if code.is_empty() {
        let _ = app.emit("mp_error", "Código de autorização vazio.");
        return;
    }
    let verifier = load_secrets(&secrets_path).mp_pkce_verifier.unwrap_or_default();
    if verifier.is_empty() {
        let _ = app.emit(
            "mp_error",
            "Sessão de conexão expirada: clique em «Conectar Mercado Pago» novamente.",
        );
        return;
    }
    match exchange_code(&cfg, &code, &verifier) {
        Ok(token) => match save_token(&secrets_path, &token) {
            Ok(secrets) => {
                clear_pkce_verifier(&secrets_path);
                let _ = app.emit("mp_connected", status(&secrets));
            }
            Err(e) => {
                let _ = app.emit("mp_error", format!("Falha ao salvar token: {e}"));
            }
        },
        Err(e) => {
            let _ = app.emit("mp_error", e);
        }
    }
}

/// Remove o `code_verifier` já consumido (não deve ser reutilizado).
fn clear_pkce_verifier(path: &PathBuf) {
    let mut s = load_secrets(path);
    if s.mp_pkce_verifier.is_some() {
        s.mp_pkce_verifier = None;
        let _ = save_secrets(path, &s);
    }
}

pub fn start_oauth(app: AppHandle, secrets_path: PathBuf) {
    let cfg = match config_from_env() {
        Some(c) => c,
        None => {
            let _ = app.emit(
                "mp_error",
                "Credenciais do Mercado Pago ausentes (defina MP_ACCESS_TOKEN ou MP_CLIENT_ID/MP_CLIENT_SECRET no .env).",
            );
            return;
        }
    };

    if !cfg.is_marketplace() {
        let _ = app.emit(
            "mp_error",
            "MP_ACCESS_TOKEN já configurado no .env — a conta Pix está pronta, não precisa conectar via OAuth.",
        );
        return;
    }

    // PKCE: gera o verifier, persiste (necessário porque o `code` pode ser
    // colado depois) e envia o challenge na URL de autorização.
    let verifier = pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    {
        let mut s = load_secrets(&secrets_path);
        s.mp_pkce_verifier = Some(verifier.clone());
        if let Err(e) = save_secrets(&secrets_path, &s) {
            let _ = app.emit("mp_error", format!("Falha ao salvar sessão PKCE: {e}"));
            return;
        }
    }

    let url = build_auth_url(&cfg, &challenge);
    if let Err(e) = app.opener().open_url(url.clone(), None::<&str>) {
        let _ = app.emit("mp_error", format!("Falha ao abrir navegador: {e}"));
    }

    let local = is_local_redirect(&cfg.redirect_uri);
    let _ = app.emit(
        "mp_oauth_waiting",
        json!({ "redirect_uri": cfg.redirect_uri, "local": local }),
    );

    std::thread::spawn(move || {
        let port = redirect_port(&cfg.redirect_uri);
        let server = match tiny_http::Server::http(("127.0.0.1", port)) {
            Ok(s) => s,
            Err(e) => {
                if local {
                    let _ = app.emit("mp_error", format!("Falha ao abrir porta {port}: {e}"));
                }
                return;
            }
        };

        let deadline = std::time::Instant::now() + Duration::from_secs(240);
        let code;
        loop {
            if std::time::Instant::now() > deadline {
                if local {
                    let _ = app.emit("mp_error", "Tempo esgotado aguardando autorização.");
                }
                return;
            }
            match server.recv_timeout(Duration::from_secs(2)) {
                Ok(Some(req)) => {
                    let full = req.url().to_string();
                    let query = full.split('?').nth(1).unwrap_or("");
                    let code_val = query.split('&').find_map(|p| {
                        let mut it = p.splitn(2, '=');
                        match (it.next(), it.next()) {
                            (Some("code"), Some(v)) => Some(v.to_string()),
                            _ => None,
                        }
                    });
                    let html = "<html><body style='font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh'><h2>Conta Mercado Pago conectada! Pode fechar esta janela.</h2></body></html>";
                    let resp = tiny_http::Response::from_string(html).with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                    let _ = req.respond(resp);
                    code = code_val;
                    break;
                }
                Ok(None) => continue,
                Err(_) => continue,
            }
        }

        let code = match code {
            Some(c) => c,
            None => {
                let _ = app.emit("mp_error", "Authorization code não recebido.");
                return;
            }
        };

        match exchange_code(&cfg, &code, &verifier) {
            Ok(token) => match save_token(&secrets_path, &token) {
                Ok(secrets) => {
                    clear_pkce_verifier(&secrets_path);
                    let _ = app.emit("mp_connected", status(&secrets));
                }
                Err(e) => {
                    let _ = app.emit("mp_error", format!("Falha ao salvar token: {e}"));
                }
            },
            Err(e) => {
                let _ = app.emit("mp_error", e);
            }
        }
    });
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    user_id: Option<i64>,
}

/// Repete a troca de token em falhas de rede (DNS/timeout).
fn post_token(params: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let mut last = String::from("Falha de rede");
    for attempt in 1..=3u32 {
        match post_token_once(params) {
            Ok(t) => return Ok(t),
            Err(e) => {
                // Erro de negócio/HTTP: repetir não adianta.
                if e.starts_with("OAuth HTTP") || e.contains("Resposta inválida") {
                    return Err(e);
                }
                eprintln!("[mp] token tentativa {attempt}/3 falhou: {e}");
                last = e;
                std::thread::sleep(Duration::from_millis(500 * attempt as u64));
            }
        }
    }
    Err(last)
}

/// POST no /oauth/token. A doc oficial usa JSON; alguns apps antigos exigem
/// form-urlencoded. Tenta JSON primeiro e faz fallback para form.
fn post_token_once(params: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let mut body = serde_json::Map::new();
    for (k, v) in params {
        body.insert((*k).to_string(), json!(*v));
    }
    let payload = serde_json::Value::Object(body);

    let json_attempt = ureq::post(TOKEN_URL)
        .set("Accept", "application/json")
        .send_json(payload.clone());

    let last_err = match json_attempt {
        Ok(r) => {
            return r
                .into_json::<TokenResponse>()
                .map_err(|e| format!("Resposta inválida do token: {e}"))
        }
        Err(ureq::Error::Status(code, r)) => {
            let msg = format!(
                "OAuth HTTP {code}: {}",
                r.into_string().unwrap_or_else(|_| "sem corpo".into())
            );
            eprintln!("[mp] token JSON {TOKEN_URL} -> {msg}");
            msg
        }
        Err(e) => return Err(format!("Falha de rede: {e}")),
    };

    // Fallback: form-urlencoded (comportamento antigo da API)
    match ureq::post(TOKEN_URL)
        .set("Accept", "application/json")
        .send_form(params)
    {
        Ok(r) => r
            .into_json::<TokenResponse>()
            .map_err(|e| format!("Resposta inválida do token: {e}")),
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            eprintln!("[mp] token FORM {TOKEN_URL} -> HTTP {code}: {body}");
            Err(format!(
                "{last_err} | form HTTP {code}: {}",
                if body.trim().is_empty() { "sem corpo" } else { &body }
            ))
        }
        Err(e) => Err(format!("{last_err} | falha de rede no fallback: {e}")),
    }
}

fn exchange_code(cfg: &MpConfig, code: &str, verifier: &str) -> Result<TokenResponse, String> {
    let mut params: Vec<(&str, &str)> = vec![
        ("grant_type", "authorization_code"),
        ("client_id", &cfg.client_id),
        ("client_secret", &cfg.client_secret),
        ("code", code),
        ("redirect_uri", &cfg.redirect_uri),
        ("state", "maxmusicbox"),
    ];
    if !verifier.is_empty() {
        params.push(("code_verifier", verifier));
    }
    post_token(&params)
}

fn refresh(secrets_path: &PathBuf, cfg: &MpConfig) -> Result<String, String> {
    let secrets = load_secrets(secrets_path);
    let refresh_token = secrets.mp_refresh_token.clone().unwrap_or_default();
    if refresh_token.is_empty() {
        return Err("Sem refresh token. Reconecte a conta Mercado Pago.".to_string());
    }
    let token = post_token(&[
        ("grant_type", "refresh_token"),
        ("client_id", &cfg.client_id),
        ("client_secret", &cfg.client_secret),
        ("refresh_token", &refresh_token),
    ])?;
    let saved = save_token(secrets_path, &token)?;
    Ok(saved.mp_access_token.unwrap_or(token.access_token))
}

fn ensure_token(secrets_path: &PathBuf, cfg: &MpConfig) -> Result<String, String> {
    if let Some(t) = &cfg.access_token {
        if !t.trim().is_empty() {
            return Ok(t.clone());
        }
    }
    let secrets = load_secrets(secrets_path);
    let token = secrets.mp_access_token.clone().unwrap_or_default();
    if token.is_empty() {
        return Err("Conta Mercado Pago não conectada.".to_string());
    }
    let expires_at = secrets.mp_expires_at.unwrap_or(0);
    if expires_at > 0 && now_ms() > expires_at {
        return refresh(secrets_path, cfg);
    }
    Ok(token)
}

/// Mostra apenas o início/fim do token — nunca o valor completo nos logs.
fn mask_token(token: &str) -> String {
    let t = token.trim();
    if t.chars().count() <= 12 {
        return "***".to_string();
    }
    let head: String = t.chars().take(6).collect();
    let tail: String = t.chars().rev().take(4).collect::<String>().chars().rev().collect();
    format!("{head}…{tail}")
}

/// Envia a cobrança Pix. Em erro devolve (status HTTP, corpo da resposta).
/// Repete em falhas de rede (DNS/timeout), que costumam ser intermitentes.
fn send_payment(
    token: &str,
    tx_id: &str,
    body: &serde_json::Value,
) -> Result<serde_json::Value, (u16, String)> {
    let mut last_err = (0u16, String::from("Falha de rede"));
    for attempt in 1..=3u32 {
        match ureq::post(PAYMENTS_URL)
            .set("Authorization", &format!("Bearer {token}"))
            .set("X-Idempotency-Key", tx_id)
            .send_json(body.clone())
        {
            Ok(r) => return r.into_json().map_err(|e| (0, format!("Resposta inválida: {e}"))),
            // Erro HTTP real (4xx/5xx): não faz sentido repetir.
            Err(ureq::Error::Status(code, r)) => {
                return Err((code, r.into_string().unwrap_or_default()))
            }
            Err(e) => {
                eprintln!("[mp] send_payment tentativa {attempt}/3 falhou: {e}");
                last_err = (0, format!("Falha de rede: {e}"));
                std::thread::sleep(Duration::from_millis(500 * attempt as u64));
            }
        }
    }
    Err(last_err)
}

pub fn create_charge(
    app: AppHandle,
    db: Arc<Mutex<Connection>>,
    secrets_path: PathBuf,
    audio: AudioHandle,
    sound: PathBuf,
    amount: f64,
    credits: i64,
) -> Result<PixCharge, String> {
    if amount <= 0.0 {
        return Err("Valor inválido".to_string());
    }
    let cfg = config_from_env().ok_or("Mercado Pago não configurado (defina MP_CLIENT_ID / MP_CLIENT_SECRET).")?;

    let token = ensure_token(&secrets_path, &cfg)?;

    let tx_id = format!("mmb-{}", now_ms());

    let mut body = json!({
        "transaction_amount": amount,
        "description": format!("MaxMusicBox - {credits} créditos"),
        "payment_method_id": "pix",
        "payer": { "email": cfg.payer_email },
        "metadata": { "credits": credits, "tx_id": tx_id }
    });

    // application_fee só existe em apps marketplace; com Access Token fixo, omite.
    let fee = if cfg.is_marketplace() {
        let fee = ((amount * cfg.split_percent / 100.0) * 100.0).round() / 100.0;
        if let Some(obj) = body.as_object_mut() {
            obj.insert("application_fee".to_string(), json!(fee));
        }
        Some(fee)
    } else {
        None
    };

    eprintln!(
        "[mp] create_charge marketplace={} split={:?} token={} body={body}",
        cfg.is_marketplace(),
        fee,
        mask_token(&token)
    );

    // O split é obrigatório: a comissão do MaxMusicBox não pode ser descartada.
    let value = match send_payment(&token, &tx_id, &body) {
        Ok(v) => v,
        Err((code, text)) => {
            eprintln!("[mp] create_charge HTTP {code}: {text}");
            let lower = text.to_ascii_lowercase();
            if lower.contains("2059") || lower.contains("application_fee") {
                eprintln!(
                    "[mp] ERRO 2059: a aplicação NÃO foi criada com o modelo de integração \
                     MARKETPLACE. Crie uma nova aplicação em «Suas integrações» escolhendo \
                     Online Payments → Checkout API → modelo Marketplace, atualize \
                     MP_CLIENT_ID/MP_CLIENT_SECRET no .env e reconecte uma conta vendedora \
                     DIFERENTE da dona da aplicação."
                );
                return Err(
                    "Erro 2059: o split exige uma aplicação criada com o modelo de integração \
                     MARKETPLACE no painel do Mercado Pago (Online Payments → Checkout API → \
                     modelo Marketplace). A aplicação atual não tem esse modelo habilitado."
                        .to_string(),
                );
            }
            return Err(format!("Mercado Pago retornou {code}: {text}"));
        }
    };

    let payment_id = value
        .get("id")
        .map(|v| v.to_string().trim_matches('"').to_string())
        .unwrap_or_default();
    let qr_base64 = value
        .pointer("/point_of_interaction/transaction_data/qr_code_base64")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let copy_paste = value
        .pointer("/point_of_interaction/transaction_data/qr_code")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if payment_id.is_empty() {
        eprintln!("[mp] resposta sem id de pagamento: {value}");
        return Err("Resposta sem id de pagamento".to_string());
    }
    eprintln!("[mp] pix criado payment_id={payment_id} valor={amount} créditos={credits}");

    let expires_at = now_ms() + 10 * 60 * 1000;

    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let _ = conn.execute(
            "INSERT OR REPLACE INTO pix_charges (id, amount, credits, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![payment_id, amount, credits, "pending", now_ms()],
        );
    }

    let charge = PixCharge {
        tx_id,
        payment_id: payment_id.clone(),
        qr_base64,
        copy_paste,
        expires_at,
        amount,
        credits,
    };

    // Polling de confirmação em thread separada
    {
        let app2 = app.clone();
        let db2 = db.clone();
        let secrets2 = secrets_path.clone();
        let audio2 = audio.clone();
        let sound2 = sound.clone();
        let pid = payment_id.clone();
        std::thread::spawn(move || {
            poll_payment(app2, db2, secrets2, audio2, sound2, pid, credits, amount);
        });
    }

    let _ = app.emit("pix_created", &charge);
    Ok(charge)
}

fn poll_payment(
    app: AppHandle,
    db: Arc<Mutex<Connection>>,
    secrets_path: PathBuf,
    audio: AudioHandle,
    sound: PathBuf,
    payment_id: String,
    credits: i64,
    amount: f64,
) {
    let deadline = std::time::Instant::now() + Duration::from_secs(10 * 60);
    loop {
        if std::time::Instant::now() > deadline {
            let _ = app.emit("pix_expired", payment_id.clone());
            if let Ok(conn) = db.lock() {
                let _ = conn.execute(
                    "UPDATE pix_charges SET status='expired' WHERE id=?1",
                    params![payment_id],
                );
            }
            return;
        }
        std::thread::sleep(Duration::from_secs(4));

        let token = match config_from_env() {
            Some(cfg) => match ensure_token(&secrets_path, &cfg) {
                Ok(t) => t,
                Err(_) => continue,
            },
            None => return,
        };

        let url = format!("{PAYMENTS_URL}/{payment_id}");
        let resp = ureq::get(&url)
            .set("Authorization", &format!("Bearer {token}"))
            .call();
        let value: serde_json::Value = match resp {
            Ok(r) => match r.into_json() {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("[mp] poll {payment_id}: resposta inválida: {e}");
                    continue;
                }
            },
            Err(ureq::Error::Status(code, r)) => {
                let body = r.into_string().unwrap_or_default();
                eprintln!("[mp] poll {payment_id} HTTP {code}: {body}");
                continue;
            }
            Err(e) => {
                eprintln!("[mp] poll {payment_id}: falha de rede: {e}");
                continue;
            }
        };

        let status = value
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("pending")
            .to_string();
        eprintln!("[mp] poll {payment_id}: status={status}");

        match status.as_str() {
            "approved" => {
                let tx_id = format!("tx-{payment_id}");
                if let Ok(conn) = db.lock() {
                    let _ = conn.execute(
                        "UPDATE pix_charges SET status='approved' WHERE id=?1",
                        params![payment_id],
                    );
                    let _ = crate::library::insert_finance(&conn, &tx_id, amount, credits, "pix");
                }
                audio.send(AudioCmd::Sfx {
                    path: sound.to_string_lossy().to_string(),
                });
                let _ = app.emit(
                    "pix_pago",
                    json!({ "tx_id": tx_id, "credits": credits, "amount": amount, "payment_id": payment_id }),
                );
                return;
            }
            "rejected" | "cancelled" | "refunded" | "charged_back" => {
                if let Ok(conn) = db.lock() {
                    let _ = conn.execute(
                        "UPDATE pix_charges SET status=?1 WHERE id=?2",
                        params![status, payment_id],
                    );
                }
                let _ = app.emit("pix_failed", json!({ "payment_id": payment_id, "status": status }));
                return;
            }
            _ => continue,
        }
    }
}
