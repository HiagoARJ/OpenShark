//! Teste de escrita sem efeito: lê polling, energia e DPI do mouse e manda os mesmos bytes de
//! volta, conferindo a confirmação do receptor. `cargo run -p shark-device --example echo`

use std::time::Duration;

use shark_proto::report;

fn main() {
    let manager = shark_device::Manager::start(|_| {});
    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(500));
        if manager.status().awake {
            break;
        }
    }
    println!("estado: {:?}", manager.status());
    for (id, len) in [(0x06u8, 9usize), (0x05, 0x0F), (0x04, 0x38)] {
        let read = match manager.query(id, len as u8, 1) {
            Ok(b) => b,
            Err(e) => {
                println!("{id:#04x}: leitura falhou: {e}");
                continue;
            }
        };
        let packet = &read[..len];
        let valid = match id {
            0x06 => report::decode_polling(packet).is_some(),
            0x05 => report::decode_power(packet).is_some(),
            _ => report::decode_dpi(packet).is_some(),
        };
        if !valid {
            println!("{id:#04x}: resposta inválida {:02x?}", packet);
            continue;
        }
        let started = std::time::Instant::now();
        match manager.send(packet) {
            Ok(()) => println!("{id:#04x}: reenviado e confirmado em {:?}", started.elapsed()),
            Err(e) => println!("{id:#04x}: envio falhou: {e}"),
        }
    }
    manager.stop();
}
