// Módulo de Sincronização Criptografada e Telemetria Nativa - MaxMusicBox
// Comunicação direta em Rust com o backend maximo.tec.br
// Cofre seguro de credenciais compiladas internamente no binário nativo (Fallback Offline Blindado)

use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

// URLs de sincronização central
const PRIMARY_SYNC_URL: &str = "https://www.maximo.tec.br/api/sync/heartbeat";
const FALLBACK_SYNC_URL: &str = "https://adm.maximo.tec.br/api/sync/heartbeat";

// Máscara interna de ofuscação no binário (impede que ferramentas como `strings` encontrem segredos em texto puro)
const VAULT_MASK: &[u8] = b"MAXIMO_SECURITY_CORE_VAL_2026";

// Bytes ofuscados em tempo de compilação (Fallback Seguro embutido diretamente no código de máquina)
const COMPILED_CLIENT_ID: &[u8] = &[122, 112, 111, 113, 116, 123, 107, 99, 115, 122, 101, 96, 126, 100, 109, 110];
const COMPILED_CLIENT_SECRET: &[u8] = &[46, 56, 111, 112, 23, 1, 46, 39, 8, 39, 39, 22, 51, 48, 19, 29, 39, 35, 52, 11, 109, 39, 119, 29, 9, 126, 70, 11, 98, 25, 117, 106];
const COMPILED_PUBLIC_KEY: &[u8] = &[12, 17, 8, 22, 24, 28, 13, 126, 112, 113, 52, 48, 45, 109, 110, 109, 110, 121, 49, 118, 105, 123, 117, 126, 60, 10, 29, 83, 0, 122, 114, 117, 122, 127, 45, 111, 100, 124, 37, 97, 51, 40, 102, 109];
const COMPILED_ACCESS_TOKEN: &[u8] = &[12, 17, 8, 22, 24, 28, 13, 126, 114, 114, 98, 106, 112, 96, 109, 111, 117, 118, 98, 119, 104, 102, 117, 125, 114, 2, 9, 3, 1, 124, 114, 117, 120, 40, 126, 60, 97, 32, 117, 51, 102, 121, 53, 108, 107, 117, 46, 97, 38, 58, 51, 114, 41, 108, 3, 6, 6, 80, 124, 118, 58, 45, 121, 44, 114, 107, 116, 112, 103, 100, 125, 100, 109, 103];
const COMPILED_REDIRECT_URI: &[u8] = &[37, 53, 44, 57, 62, 117, 112, 124, 40, 34, 45, 59, 36, 59, 119, 43, 38, 44, 124, 39, 45, 121, 44, 60, 112, 81, 81, 94, 90, 47, 32, 59, 34, 98, 34, 62, 43, 40, 54, 38, 59, 42, 54, 54, 39];
const COMPILED_AUTH_URL: &[u8] = &[37, 53, 44, 57, 62, 117, 112, 124, 36, 54, 33, 58, 103, 57, 60, 45, 32, 46, 54, 42, 47, 55, 38, 35, 113, 81, 95, 95, 25, 44, 52, 44, 33, 34, 61, 54, 41, 36, 55, 60, 61, 39];
const COMPILED_PAYER_EMAIL: &[u8] = &[46, 45, 49, 44, 35, 59, 58, 19, 40, 34, 45, 63, 60, 39, 48, 60, 33, 32, 42, 107, 62, 38, 49];
const COMPILED_SPLIT_PERCENT: &[u8] = &[120];

// Flag estática de autorização em memória
static IS_AUTHORIZED: AtomicBool = AtomicBool::new(true);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LicenseInfo {
    pub autorizado: bool,
    pub tipo_licenca: String,
    pub status_licenca: String,
    pub ultima_sincronizacao: u64,
}

static CURRENT_LICENSE: Mutex<Option<LicenseInfo>> = Mutex::new(None);

/// Desofusca bytes compilados diretamente no código de máquina para memória RAM
fn deobfuscate(bytes: &[u8]) -> String {
    let mut out = Vec::with_capacity(bytes.len());
    for (i, &b) in bytes.iter().enumerate() {
        out.push(b ^ VAULT_MASK[i % VAULT_MASK.len()]);
    }
    String::from_utf8(out).unwrap_or_default()
}

/// Cifra ou decifra dados com a chave derivada do Machine ID da máquina
fn cipher_with_machine_key(data: &[u8], machine_id: &str) -> Vec<u8> {
    let key = machine_id.as_bytes();
    let mut out = Vec::with_capacity(data.len());
    for (i, &b) in data.iter().enumerate() {
        out.push(b ^ key[i % key.len()]);
    }
    out
}

/// Retorna ou cria um identificador único e persistente de hardware da máquina
pub fn get_or_create_machine_id(app_handle: &AppHandle) -> String {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    
    let id_file = app_dir.join(".machine_node.key");

    if let Ok(content) = fs::read_to_string(&id_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    // Gera um Machine ID único combinando variáveis de hardware locais
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "MAX-STATION".to_string());
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let rand_val = rand::random::<u64>();

    let mut hasher = Sha256::new();
    hasher.update(format!("MAX_HW_{}_{}_{}_{}", hostname, os, arch, rand_val).as_bytes());
    let machine_id = format!("NODE-{}", hasher.finalize()[..8].iter().map(|b| format!("{:02X}", b)).collect::<String>());

    let _ = fs::create_dir_all(&app_dir);
    let _ = fs::write(&id_file, &machine_id);

    machine_id
}

/// Inicializa o cofre de credenciais embutidas compiladas no binário nativo.
/// Se a máquina estiver sem internet, este fallback garante o funcionamento offline seguro.
pub fn init_compiled_fallback_vault(app_handle: &AppHandle) {
    let machine_id = get_or_create_machine_id(app_handle);
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let cache_file = app_dir.join(".vault_cache.dat");

    // 1. Tenta carregar do cache cifrado local (atualizado pelo último sincronismo bem sucedido)
    let mut loaded_from_cache = false;
    if let Ok(encrypted_bytes) = fs::read(&cache_file) {
        let decrypted = cipher_with_machine_key(&encrypted_bytes, &machine_id);
        if let Ok(val) = serde_json::from_slice::<Value>(&decrypted) {
            apply_credentials_to_env(&val);
            println!("[VAULT CORE]: Credenciais carregadas do cofre criptografado local.");
            loaded_from_cache = true;
        }
    }

    // 2. Se não houver cache anterior, aplica os valores compilados diretamente no binário (Fallback Seguro)
    if !loaded_from_cache {
        println!("[VAULT CORE]: Inicializando com credenciais embutidas no binário (Fallback Nativo).");
        std::env::set_var("MP_CLIENT_ID", deobfuscate(COMPILED_CLIENT_ID));
        std::env::set_var("MP_CLIENT_SECRET", deobfuscate(COMPILED_CLIENT_SECRET));
        std::env::set_var("MP_PUBLIC_KEY", deobfuscate(COMPILED_PUBLIC_KEY));
        std::env::set_var("MP_ACCESS_TOKEN", deobfuscate(COMPILED_ACCESS_TOKEN));
        std::env::set_var("MP_REDIRECT_URI", deobfuscate(COMPILED_REDIRECT_URI));
        std::env::set_var("MP_AUTH_URL", deobfuscate(COMPILED_AUTH_URL));
        std::env::set_var("MP_PAYER_EMAIL", deobfuscate(COMPILED_PAYER_EMAIL));
        std::env::set_var("MP_SPLIT_PERCENT", deobfuscate(COMPILED_SPLIT_PERCENT));
    }
}

/// Aplica um objeto JSON de configurações remotas às variáveis de ambiente em memória
fn apply_credentials_to_env(remoto: &Value) {
    if let Some(v) = remoto.get("mp_client_id").and_then(|v| v.as_str()) {
        std::env::set_var("MP_CLIENT_ID", v);
    }
    if let Some(v) = remoto.get("mp_client_secret").and_then(|v| v.as_str()) {
        std::env::set_var("MP_CLIENT_SECRET", v);
    }
    if let Some(v) = remoto.get("mp_public_key").and_then(|v| v.as_str()) {
        std::env::set_var("MP_PUBLIC_KEY", v);
    }
    if let Some(v) = remoto.get("mp_access_token").and_then(|v| v.as_str()) {
        std::env::set_var("MP_ACCESS_TOKEN", v);
    }
    if let Some(v) = remoto.get("mp_redirect_uri").and_then(|v| v.as_str()) {
        std::env::set_var("MP_REDIRECT_URI", v);
    }
    if let Some(v) = remoto.get("mp_auth_url").and_then(|v| v.as_str()) {
        std::env::set_var("MP_AUTH_URL", v);
    }
    if let Some(v) = remoto.get("mp_payer_email").and_then(|v| v.as_str()) {
        std::env::set_var("MP_PAYER_EMAIL", v);
    }
    if let Some(v) = remoto.get("mp_split_percent") {
        if let Some(s) = v.as_str() {
            std::env::set_var("MP_SPLIT_PERCENT", s);
        } else if let Some(n) = v.as_f64() {
            std::env::set_var("MP_SPLIT_PERCENT", n.to_string());
        }
    }
}

/// Executa a sincronização segura via Rust diretamente com o backend da Maximo Tecnologias
pub fn perform_heartbeat_sync(app_handle: &AppHandle) -> Result<Value, String> {
    let machine_id = get_or_create_machine_id(app_handle);
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Computador Local".to_string());
    
    let os_info = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
    let versao = "1.2.0";

    // Cria o payload de telemetria
    let payload_obj = json!({
        "slug_programa": "maxmusicbox",
        "machine_id": machine_id,
        "hostname": hostname,
        "os_info": os_info,
        "versao": versao,
        "hardware": {
            "os": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
        }
    });

    let raw_json = payload_obj.to_string();
    let encoded_payload = STANDARD.encode(raw_json.as_bytes());

    let req_body = json!({
        "slug_programa": "maxmusicbox",
        "machine_id": machine_id,
        "payload": encoded_payload
    });

    println!("[SYNC RUST]: Enviando telemetria criptografada para o backend Máximo...");

    // Tenta primeiro o endpoint principal, depois o fallback
    let urls = [PRIMARY_SYNC_URL, FALLBACK_SYNC_URL];
    let mut last_error = String::new();

    for url in &urls {
        let resp = ureq::post(url)
            .timeout(Duration::from_secs(12))
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("User-Agent", "MaxMusicBox-Rust-Agent/1.2")
            .send_json(&req_body);

        match resp {
            Ok(r) => {
                if let Ok(body) = r.into_json::<Value>() {
                    println!("[SYNC RUST]: Telemetria aceita pelo servidor. Processando resposta segura.");
                    
                    if let Some(data) = body.get("data") {
                        let autorizado = data.get("autorizado").and_then(|v| v.as_bool()).unwrap_or(true);
                        let status_licenca = data.get("status_licenca").and_then(|v| v.as_str()).unwrap_or("ativa").to_string();
                        let tipo_licenca = data.get("tipo_licenca").and_then(|v| v.as_str()).unwrap_or("faturavel").to_string();

                        IS_AUTHORIZED.store(autorizado, Ordering::SeqCst);

                        // Atualiza configurações seguras recebidas remotamente (ex: credenciais do Mercado Pago)
                        if let Some(remoto) = data.get("configuracoes_remotas") {
                            apply_credentials_to_env(remoto);
                            println!("[SYNC RUST]: Credenciais remotas aplicadas na memória RAM.");

                            // Salva no cofre cifrado local para o próximo boot offline
                            let app_dir = app_handle
                                .path()
                                .app_data_dir()
                                .unwrap_or_else(|_| PathBuf::from("."));
                            let cache_file = app_dir.join(".vault_cache.dat");
                            let plain_bytes = serde_json::to_vec(remoto).unwrap_or_default();
                            let encrypted = cipher_with_machine_key(&plain_bytes, &machine_id);
                            let _ = fs::write(&cache_file, &encrypted);
                        }

                        let lic_info = LicenseInfo {
                            autorizado,
                            tipo_licenca: tipo_licenca.clone(),
                            status_licenca: status_licenca.clone(),
                            ultima_sincronizacao: chrono::Utc::now().timestamp() as u64,
                        };

                        if let Ok(mut lock) = CURRENT_LICENSE.lock() {
                            *lock = Some(lic_info.clone());
                        }

                        // Notifica a interface do MaxMusicBox caso a licença tenha sido alterada
                        let _ = app_handle.emit("license_status_updated", lic_info);

                        return Ok(body);
                    }
                }
            }
            Err(e) => {
                last_error = format!("Falha ao conectar em {}: {}", url, e);
                println!("[SYNC RUST WARN]: {}", last_error);
            }
        }
    }

    Err(last_error)
}

/// Inicia a thread em segundo plano responsável pelo heartbeat periódico
pub fn start_sync_worker(app_handle: AppHandle) {
    // 1. Carrega imediatamente o fallback compilado / cofre local em memória
    init_compiled_fallback_vault(&app_handle);

    let app_clone = app_handle.clone();
    std::thread::spawn(move || {
        println!("[SYNC WORKER]: Iniciando rotina de sincronização em segundo plano...");
        
        // Espera 3 segundos após boot antes do primeiro sync
        std::thread::sleep(Duration::from_secs(3));
        let _ = perform_heartbeat_sync(&app_clone);

        loop {
            // Repete o sincronismo a cada 10 minutos (600 segundos)
            std::thread::sleep(Duration::from_secs(600));
            println!("[SYNC WORKER]: Executando sincronismo periódico de heartbeat...");
            let _ = perform_heartbeat_sync(&app_clone);
        }
    });
}

/// Comando Tauri para o frontend checar o status ou forçar sincronização
#[tauri::command]
pub fn sync_telemetry_now(app: AppHandle) -> Result<Value, String> {
    perform_heartbeat_sync(&app)
}

/// Comando Tauri para obter a informação de licença atual
#[tauri::command]
pub fn get_license_info(_app: AppHandle) -> LicenseInfo {
    if let Ok(lock) = CURRENT_LICENSE.lock() {
        if let Some(ref lic) = *lock {
            return lic.clone();
        }
    }

    LicenseInfo {
        autorizado: IS_AUTHORIZED.load(Ordering::SeqCst),
        tipo_licenca: "faturavel".to_string(),
        status_licenca: if IS_AUTHORIZED.load(Ordering::SeqCst) { "ativa".to_string() } else { "bloqueada".to_string() },
        ultima_sincronizacao: 0,
    }
}
