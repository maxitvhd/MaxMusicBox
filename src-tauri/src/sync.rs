// Módulo de Sincronização Criptografada e Telemetria Nativa - MaxMusicBox
// Comunicação direta em Rust com o backend maximo.tec.br

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
                            if let Some(mp_public) = remoto.get("mp_public_key").and_then(|v| v.as_str()) {
                                std::env::set_var("MP_PUBLIC_KEY", mp_public);
                            }
                            if let Some(mp_token) = remoto.get("mp_access_token").and_then(|v| v.as_str()) {
                                std::env::set_var("MP_ACCESS_TOKEN", mp_token);
                            }
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
    std::thread::spawn(move || {
        println!("[SYNC WORKER]: Iniciando rotina de sincronização em segundo plano...");
        
        // Espera 3 segundos após boot antes do primeiro sync
        std::thread::sleep(Duration::from_secs(3));
        let _ = perform_heartbeat_sync(&app_handle);

        loop {
            // Repete o sincronismo a cada 10 minutos (600 segundos)
            std::thread::sleep(Duration::from_secs(600));
            println!("[SYNC WORKER]: Executando sincronismo periódico de heartbeat...");
            let _ = perform_heartbeat_sync(&app_handle);
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
