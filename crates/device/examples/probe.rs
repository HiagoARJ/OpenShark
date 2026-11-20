//! Diagnóstico só de leitura: mostra o estado do receptor por alguns segundos e lê a configuração.
//! `cargo run -p shark-device --example probe`

use std::time::Duration;

fn main() {
    let manager = shark_device::Manager::start(|e| println!("evento: {e:?}"));
    std::thread::sleep(Duration::from_secs(5));
    println!("estado: {:?}", manager.status());
    match manager.read_config() {
        Ok(cfg) => println!("configuração: {cfg:#?}"),
        Err(e) => println!("leitura: {e}"),
    }
    manager.stop();
}
