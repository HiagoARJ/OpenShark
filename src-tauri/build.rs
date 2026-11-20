use std::path::PathBuf;

fn main() {
    // `generate_context!` exige que `frontendDist` exista já na compilação; num checkout limpo
    // (antes do `pnpm --dir ui build`) um placeholder deixa `cargo check`/`cargo test` funcionarem.
    let dist = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/dist");
    if !dist.join("index.html").exists() {
        let _ = std::fs::create_dir_all(&dist);
        let _ = std::fs::write(
            dist.join("index.html"),
            "<!doctype html><meta charset=utf-8><title>OpenShark</title>\
             <p style=\"font-family:sans-serif\">Interface não compilada. Rode <code>pnpm --dir ui build</code>.</p>",
        );
    }
    tauri_build::build()
}
