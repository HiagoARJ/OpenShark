//! Ícone da bandeja desenhado na hora: a barbatana do OpenShark, que muda de cor conforme a
//! bateria (do vermelho, vazia, ao verde, cheia). 32×32, sem número: a porcentagem fica na dica.

use shark_device::{Link, Status};

pub const SIZE: usize = 32;

type Rgb = [u8; 3];

const BLUE: Rgb = [0x2E, 0x9B, 0xF5];

/// O que muda o desenho; o ícone só é refeito quando isto muda.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Look {
    pub battery: u8,
    pub charging: bool,
    /// Mouse dormindo: a cor do último valor conhecido, esmaecida.
    pub asleep: bool,
}

impl Look {
    /// `None` quando não há bateria para mostrar (sem mouse, no cabo, ainda sem leitura): a
    /// bandeja fica com o ícone do programa.
    pub fn from_status(status: &Status) -> Option<Look> {
        if status.link != Some(Link::Wireless) {
            return None;
        }
        let battery = if status.full { 100 } else { status.battery? };
        Some(Look { battery: battery.min(100), charging: status.charging, asleep: !status.awake })
    }

    /// Azul carregando; senão o matiz vai do vermelho (0%) ao verde (100%), passando por laranja
    /// e amarelo.
    fn color(&self) -> Rgb {
        if self.charging {
            return BLUE;
        }
        hsl(self.battery as f32 * 1.3, 0.85, 0.52)
    }
}

/// HSL (matiz em graus) para RGB.
fn hsl(h: f32, s: f32, l: f32) -> Rgb {
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let (r, g, b) = match h as u32 / 60 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    let m = l - c / 2.0;
    [r, g, b].map(|v| ((v + m) * 255.0).round() as u8)
}

/// Coordenadas do desenho da marca (`icons/brand.svg`, 512×512) para pixels do ícone.
fn to_px((x, y): (f32, f32)) -> (f32, f32) {
    ((x - 93.0) * 0.097, (y - 84.0) * 0.097)
}

/// Pontos de uma curva de Bézier cúbica (sem o ponto inicial).
fn cubic(p: [(f32, f32); 4], out: &mut Vec<(f32, f32)>) {
    for k in 1..=12 {
        let t = k as f32 / 12.0;
        let u = 1.0 - t;
        let w = [u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t];
        let x = (0..4).map(|i| w[i] * p[i].0).sum();
        let y = (0..4).map(|i| w[i] * p[i].1).sum();
        out.push(to_px((x, y)));
    }
}

/// Contorno da barbatana e a linha da onda embaixo dela.
fn shapes() -> (Vec<(f32, f32)>, Vec<(f32, f32)>) {
    let mut fin = vec![to_px((104.0, 362.0))];
    cubic([(104.0, 362.0), (196.0, 336.0), (300.0, 236.0), (372.0, 92.0)], &mut fin);
    cubic([(372.0, 92.0), (336.0, 196.0), (344.0, 296.0), (414.0, 362.0)], &mut fin);
    let mut wave = vec![to_px((96.0, 392.0))];
    cubic([(96.0, 392.0), (170.0, 368.0), (240.0, 410.0), (300.0, 392.0)], &mut wave);
    cubic([(300.0, 392.0), (360.0, 374.0), (400.0, 372.0), (420.0, 388.0)], &mut wave);
    (fin, wave)
}

fn inside(poly: &[(f32, f32)], x: f32, y: f32) -> bool {
    let mut hit = false;
    for k in 0..poly.len() {
        let (a, b) = (poly[k], poly[(k + 1) % poly.len()]);
        if (a.1 > y) != (b.1 > y) && x < a.0 + (y - a.1) / (b.1 - a.1) * (b.0 - a.0) {
            hit = !hit;
        }
    }
    hit
}

fn segment_distance(a: (f32, f32), b: (f32, f32), x: f32, y: f32) -> f32 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let t = (((x - a.0) * dx + (y - a.1) * dy) / (dx * dx + dy * dy).max(1e-6)).clamp(0.0, 1.0);
    ((x - a.0 - t * dx).powi(2) + (y - a.1 - t * dy).powi(2)).sqrt()
}

/// Cobertura (0..=1) da barbatana e da onda no pixel `(x, y)`: 4×4 amostras para a borda sair lisa.
fn coverage(fin: &[(f32, f32)], wave: &[(f32, f32)], x: usize, y: usize) -> f32 {
    let mut hits = 0;
    for sy in 0..4 {
        for sx in 0..4 {
            let (px, py) = (x as f32 + (sx as f32 + 0.5) / 4.0, y as f32 + (sy as f32 + 0.5) / 4.0);
            if inside(fin, px, py) {
                hits += 1;
            }
        }
    }
    let (cx, cy) = (x as f32 + 0.5, y as f32 + 0.5);
    let d = wave.windows(2).map(|w| segment_distance(w[0], w[1], cx, cy)).fold(f32::MAX, f32::min);
    (hits as f32 / 16.0).max((1.6 - d).clamp(0.0, 1.0) * 0.7)
}

pub fn render(look: Look) -> Vec<u8> {
    let (fin, wave) = shapes();
    let color = look.color();
    let opacity = if look.asleep { 0.5 } else { 1.0 };
    let mut rgba = vec![0u8; SIZE * SIZE * 4];
    for y in 0..SIZE {
        for x in 0..SIZE {
            let i = (y * SIZE + x) * 4;
            rgba[i..i + 3].copy_from_slice(&color);
            rgba[i + 3] = (coverage(&fin, &wave, x, y) * opacity * 255.0).round() as u8;
        }
    }
    rgba
}

#[cfg(test)]
mod tests {
    use super::*;

    fn look(battery: u8) -> Look {
        Look { battery, charging: false, asleep: false }
    }

    #[test]
    fn desenha_todos_os_niveis() {
        for battery in 0..=100 {
            let rgba = render(look(battery));
            assert_eq!(rgba.len(), SIZE * SIZE * 4);
            // Canto de cima transparente; o miolo da barbatana opaco.
            assert_eq!(rgba[3], 0);
            assert_eq!(rgba[(22 * SIZE + 22) * 4 + 3], 255);
        }
    }

    #[test]
    fn cor_vai_do_vermelho_ao_verde() {
        let [r, g, _] = look(0).color();
        assert!(r > 200 && g < 80);
        let [r, g, _] = look(100).color();
        assert!(g > 200 && r < 80);
        assert_eq!(Look { charging: true, ..look(40) }.color(), BLUE);
    }

    /// `cargo test -p shark-app amostra -- --ignored` grava `tray-amostra.rgba` (8 ícones lado a
    /// lado) na pasta temporária, para conferir o desenho.
    #[test]
    #[ignore]
    fn amostra() {
        let looks = [look(100), look(86), look(60), look(40), look(20), look(4), Look { charging: true, ..look(62) }, Look { asleep: true, ..look(86) }];
        let mut sheet = vec![0u8; SIZE * looks.len() * SIZE * 4];
        for (n, l) in looks.iter().enumerate() {
            let icon = render(*l);
            for y in 0..SIZE {
                let dst = (y * SIZE * looks.len() + n * SIZE) * 4;
                sheet[dst..dst + SIZE * 4].copy_from_slice(&icon[y * SIZE * 4..(y + 1) * SIZE * 4]);
            }
        }
        std::fs::write(std::env::temp_dir().join("tray-amostra.rgba"), sheet).unwrap();
    }
}
