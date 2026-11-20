//! Conexão com o mouse: acha o receptor 2.4G (ou o mouse no cabo), escuta os eventos do canal
//! "OSD" (report 0x03), manda feature reports com repetição até a confirmação
//! e lê a configuração atual.
//!
//! Uma thread de monitoramento (`Manager::start`) refaz a enumeração a cada segundo; outra lê os
//! eventos do receptor enquanto ele estiver conectado.

use std::fmt;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use shark_proto::models::{DONGLE_PID, Model, VID};
use shark_proto::report::{self, DeviceConfig, OsdEvent};

/// Usage page da coleção de configuração (feature reports).
const FEATURE_PAGE: u16 = 0x0B;
/// Usage page da coleção de eventos (report de entrada 0x03).
const OSD_PAGE: u16 = 0x0A;
/// Sem heartbeat por este tempo, o mouse está dormindo ou desligado (o heartbeat vem a cada ~2 s).
const HEARTBEAT_TIMEOUT: Duration = Duration::from_millis(6500);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Link {
    Wireless,
    Wired,
}

/// Estado mostrado na interface.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Receptor ou mouse aberto.
    pub link: Option<Link>,
    /// Número do modelo (`MS_<n>`), quando já identificado.
    pub model: Option<u8>,
    /// O mouse respondeu nos últimos segundos (sem isso, só o receptor está ligado).
    pub awake: bool,
    pub battery: Option<u8>,
    pub charging: bool,
    pub full: bool,
    /// Estágio de DPI trocado no próprio mouse (1-based).
    pub dpi_stage: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum DeviceEvent {
    Status { status: Status },
    Osd { event: OsdEvent },
}

#[derive(Debug)]
pub enum Error {
    NotConnected,
    /// O mouse não confirmou o pacote (dormindo, fora de alcance).
    NoAck,
    /// O mouse não respondeu à leitura.
    NotReady,
    Hid(hidapi::HidError),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::NotConnected => write!(f, "nenhum mouse conectado"),
            Error::NoAck => write!(f, "o mouse não confirmou (mexa o mouse para acordá-lo e tente de novo)"),
            Error::NotReady => write!(f, "o mouse não respondeu à leitura (mexa o mouse e tente de novo)"),
            Error::Hid(e) => write!(f, "erro HID: {e}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<hidapi::HidError> for Error {
    fn from(e: hidapi::HidError) -> Self {
        Error::Hid(e)
    }
}

type Callback = Arc<dyn Fn(DeviceEvent) + Send + Sync>;

struct Io {
    feature: HidDevice,
    link: Link,
    /// Caminho da coleção de feature, para saber quando o aparelho saiu.
    path: String,
}

struct Inner {
    status: Mutex<Status>,
    last_seen: Mutex<Option<Instant>>,
    io: Mutex<Option<Io>>,
    ack: Mutex<Option<bool>>,
    ack_cv: Condvar,
    /// Incrementa a cada conexão; a thread de leitura de uma conexão antiga termina sozinha.
    generation: AtomicU64,
    stop: AtomicBool,
    on_event: Callback,
}

#[derive(Clone)]
pub struct Manager {
    inner: Arc<Inner>,
}

impl Manager {
    pub fn start(on_event: impl Fn(DeviceEvent) + Send + Sync + 'static) -> Manager {
        let inner = Arc::new(Inner {
            status: Mutex::new(Status::default()),
            last_seen: Mutex::new(None),
            io: Mutex::new(None),
            ack: Mutex::new(None),
            ack_cv: Condvar::new(),
            generation: AtomicU64::new(0),
            stop: AtomicBool::new(false),
            on_event: Arc::new(on_event),
        });
        let worker = inner.clone();
        thread::Builder::new()
            .name("shark-monitor".into())
            .spawn(move || monitor(worker))
            .expect("thread de monitoramento");
        Manager { inner }
    }

    pub fn status(&self) -> Status {
        self.inner.status.lock().unwrap().clone()
    }

    pub fn stop(&self) {
        self.inner.stop.store(true, Ordering::SeqCst);
    }

    /// Manda um feature report. Pelo cabo: até 5 tentativas com 200 ms entre elas. Pelo receptor:
    /// repete a cada 500 ms (até 10 vezes) até o mouse confirmar com o evento 0x50.
    pub fn send(&self, packet: &[u8]) -> Result<(), Error> {
        let io = self.inner.io.lock().unwrap();
        let io = io.as_ref().ok_or(Error::NotConnected)?;
        log::debug!("enviando {:02x?}", &packet[..packet.len().min(16)]);
        match io.link {
            Link::Wired => {
                for _ in 0..5 {
                    let ok = io.feature.send_feature_report(packet).is_ok();
                    thread::sleep(Duration::from_millis(200));
                    if ok {
                        return Ok(());
                    }
                }
                Err(Error::NoAck)
            }
            Link::Wireless => {
                *self.inner.ack.lock().unwrap() = None;
                for _ in 0..10 {
                    let _ = io.feature.send_feature_report(packet);
                    if self.wait_ack(Duration::from_millis(500)) {
                        return Ok(());
                    }
                }
                Err(Error::NoAck)
            }
        }
    }

    /// Manda um pacote de macro (0x09, 131 bytes) nos 3 blocos de 64 bytes.
    pub fn send_macro(&self, packet: &[u8; 0x83]) -> Result<(), Error> {
        let io = self.inner.io.lock().unwrap();
        let io = io.as_ref().ok_or(Error::NotConnected)?;
        let wireless = io.link == Link::Wireless;
        let chunks = report::split_macro(packet, wireless);
        if !wireless {
            for c in &chunks {
                io.feature.send_feature_report(c)?;
                thread::sleep(Duration::from_millis(200));
            }
            return Ok(());
        }
        *self.inner.ack.lock().unwrap() = None;
        for _ in 0..10 {
            for (k, c) in chunks.iter().enumerate() {
                let _ = io.feature.send_feature_report(c);
                if k < 2 {
                    thread::sleep(Duration::from_millis(500));
                }
            }
            if self.wait_ack(Duration::from_millis(500)) {
                return Ok(());
            }
        }
        Err(Error::NoAck)
    }

    fn wait_ack(&self, timeout: Duration) -> bool {
        let guard = self.inner.ack.lock().unwrap();
        let (guard, _) = self
            .inner
            .ack_cv
            .wait_timeout_while(guard, timeout, |ack| ack.is_none())
            .unwrap();
        *guard == Some(true)
    }

    /// Lê um feature report: pedido `A0 id len 00 flag`, espera o `A0` voltar com o byte 1 = 1 e
    /// lê o report `id`.
    pub fn query(&self, id: u8, len: u8, flag: u8) -> Result<Vec<u8>, Error> {
        let io = self.inner.io.lock().unwrap();
        let io = io.as_ref().ok_or(Error::NotConnected)?;
        let request = report::query_request(id, len, flag);
        for _ in 0..4 {
            io.feature.send_feature_report(&request)?;
            for _ in 0..8 {
                thread::sleep(Duration::from_millis(125));
                let mut st = [0u8; 64];
                st[0] = 0xA0;
                if io.feature.get_feature_report(&mut st).is_ok() && st[1] == 1 {
                    thread::sleep(Duration::from_millis(50));
                    let mut buf = [0u8; 64];
                    buf[0] = id;
                    let n = io.feature.get_feature_report(&mut buf)?;
                    if buf[0] == id {
                        return Ok(buf[..n.max(len as usize).min(64)].to_vec());
                    }
                }
            }
        }
        Err(Error::NotReady)
    }

    /// Lê DPI, energia e polling (a sincronização feita ao conectar).
    pub fn read_config(&self) -> Result<DeviceConfig, Error> {
        let mut cfg = DeviceConfig::default();
        let mut last = None;
        match self.query(0x04, 0x38, 1) {
            Ok(b) => cfg.dpi = report::decode_dpi(&b),
            Err(e) => last = Some(e),
        }
        match self.query(0x05, 0x0F, 1) {
            Ok(b) => cfg.power = report::decode_power(&b),
            Err(e) => last = Some(e),
        }
        match self.query(0x06, 0x09, 1) {
            Ok(b) => cfg.polling = report::decode_polling(&b),
            Err(e) => last = Some(e),
        }
        match (cfg.dpi.is_none() && cfg.power.is_none() && cfg.polling.is_none(), last) {
            (true, Some(e)) => Err(e),
            _ => Ok(cfg),
        }
    }
}

impl Inner {
    fn emit_status(&self) {
        let status = self.status.lock().unwrap().clone();
        (self.on_event)(DeviceEvent::Status { status });
    }

    fn update(&self, f: impl FnOnce(&mut Status)) {
        let changed = {
            let mut s = self.status.lock().unwrap();
            let before = s.clone();
            f(&mut s);
            *s != before
        };
        if changed {
            self.emit_status();
        }
    }
}

/// Coleções encontradas numa enumeração.
struct Found {
    link: Link,
    model: Option<u8>,
    feature: String,
    osd: Option<String>,
}

fn find(api: &HidApi) -> Option<Found> {
    let devices: Vec<_> = api.device_list().filter(|d| d.vendor_id() == VID).collect();
    let path = |pid: u16, page: u16| {
        devices
            .iter()
            .find(|d| d.product_id() == pid && d.usage_page() == page)
            .map(|d| d.path().to_string_lossy().into_owned())
    };
    // Cabo primeiro: com o mouse no cabo, o receptor fica de lado.
    for d in &devices {
        if let Some(model) = Model::by_wired_pid(d.product_id()) {
            if let Some(feature) = path(d.product_id(), FEATURE_PAGE) {
                return Some(Found {
                    link: Link::Wired,
                    model: Some(model.number),
                    feature,
                    osd: path(d.product_id(), OSD_PAGE),
                });
            }
        }
    }
    path(DONGLE_PID, FEATURE_PAGE).map(|feature| Found {
        link: Link::Wireless,
        model: None,
        feature,
        osd: path(DONGLE_PID, OSD_PAGE),
    })
}

fn monitor(inner: Arc<Inner>) {
    let mut api = match HidApi::new() {
        Ok(api) => api,
        Err(e) => {
            log::error!("hidapi: {e}");
            return;
        }
    };
    while !inner.stop.load(Ordering::SeqCst) {
        if let Err(e) = api.refresh_devices() {
            log::warn!("enumeração HID: {e}");
        }
        let found = find(&api);
        let current = inner.io.lock().unwrap().as_ref().map(|io| (io.path.clone(), io.link));
        match (&current, &found) {
            (Some((path, link)), Some(f)) if *path == f.feature && *link == f.link => {}
            (None, None) => {}
            _ => {
                disconnect(&inner);
                if let Some(f) = found {
                    connect(&api, &inner, f);
                }
            }
        }
        // Heartbeat atrasado: o mouse dormiu ou foi desligado (o receptor continua ali).
        let stale = inner.last_seen.lock().unwrap().is_none_or(|t| t.elapsed() > HEARTBEAT_TIMEOUT);
        let wired = inner.status.lock().unwrap().link == Some(Link::Wired);
        if stale && !wired {
            inner.update(|s| s.awake = false);
        }
        thread::sleep(Duration::from_millis(1000));
    }
    disconnect(&inner);
}

fn disconnect(inner: &Arc<Inner>) {
    inner.generation.fetch_add(1, Ordering::SeqCst);
    let had = inner.io.lock().unwrap().take().is_some();
    *inner.last_seen.lock().unwrap() = None;
    if had {
        log::info!("desconectado");
        inner.update(|s| *s = Status::default());
    }
}

fn connect(api: &HidApi, inner: &Arc<Inner>, f: Found) {
    let feature = match api.open_path(&std::ffi::CString::new(f.feature.clone()).unwrap()) {
        Ok(d) => d,
        Err(e) => {
            log::warn!("abrindo {}: {e}", f.feature);
            return;
        }
    };
    let generation = inner.generation.fetch_add(1, Ordering::SeqCst) + 1;
    *inner.io.lock().unwrap() = Some(Io { feature, link: f.link, path: f.feature.clone() });
    log::info!("conectado: {:?} modelo {:?}", f.link, f.model);
    inner.update(|s| {
        *s = Status {
            link: Some(f.link),
            model: f.model,
            awake: f.link == Link::Wired,
            ..Status::default()
        }
    });
    if let Some(osd) = f.osd {
        match api.open_path(&std::ffi::CString::new(osd).unwrap()) {
            Ok(dev) => {
                let inner = inner.clone();
                thread::Builder::new()
                    .name("shark-osd".into())
                    .spawn(move || read_osd(inner, dev, generation))
                    .expect("thread do receptor");
            }
            Err(e) => log::warn!("canal de eventos: {e}"),
        }
    }
}

fn read_osd(inner: Arc<Inner>, dev: HidDevice, generation: u64) {
    let mut buf = [0u8; 64];
    while inner.generation.load(Ordering::SeqCst) == generation && !inner.stop.load(Ordering::SeqCst) {
        let n = match dev.read_timeout(&mut buf, 250) {
            Ok(0) => continue,
            Ok(n) => n,
            Err(e) => {
                log::warn!("lendo eventos: {e}");
                break;
            }
        };
        let Some(event) = report::parse_osd(&buf[..n]) else { continue };
        log::trace!("osd {:02x?} → {event:?}", &buf[..n]);
        *inner.last_seen.lock().unwrap() = Some(Instant::now());
        let model = Model::by_code(event.code()).map(|m| m.number);
        match event {
            OsdEvent::Ack { ok, .. } => {
                *inner.ack.lock().unwrap() = Some(ok);
                inner.ack_cv.notify_all();
            }
            OsdEvent::Status { battery, charging, full, .. } => inner.update(|s| {
                s.awake = true;
                s.model = model.or(s.model);
                s.battery = Some(battery);
                s.charging = charging;
                s.full = full;
            }),
            OsdEvent::DpiStage { stage, .. } => inner.update(|s| {
                s.awake = true;
                s.model = model.or(s.model);
                s.dpi_stage = Some(stage);
            }),
            _ => inner.update(|s| {
                s.awake = true;
                s.model = model.or(s.model);
            }),
        }
        (inner.on_event)(DeviceEvent::Osd { event });
    }
}
