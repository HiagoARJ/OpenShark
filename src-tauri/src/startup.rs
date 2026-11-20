//! "Iniciar com o Windows": valor `OpenShark` em `HKCU\Software\Microsoft\Windows\
//! CurrentVersion\Run` com o caminho do executável e `--minimized` (abre direto na bandeja).

pub const MINIMIZED_ARG: &str = "--minimized";

#[cfg(windows)]
pub fn set(enabled: bool) -> Result<(), String> {
    use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    use windows::Win32::System::Registry::{HKEY_CURRENT_USER, REG_SZ, RegDeleteKeyValueW, RegSetKeyValueW};
    use windows::core::{HSTRING, PCWSTR, w};

    const RUN_KEY: PCWSTR = w!(r"Software\Microsoft\Windows\CurrentVersion\Run");
    const VALUE: PCWSTR = w!("OpenShark");
    /// Nome usado antes de o app se chamar OpenShark; sempre removido.
    const OLD_VALUE: PCWSTR = w!("AttackSharkRS");

    // SAFETY: só ponteiros para literais estáticos.
    let _ = unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, RUN_KEY, OLD_VALUE) };

    if enabled {
        let exe = std::env::current_exe().map_err(|e| format!("executável não encontrado: {e}"))?;
        let line = HSTRING::from(format!("\"{}\" {MINIMIZED_ARG}", exe.display()));
        let bytes = u32::try_from((line.len() + 1) * 2).map_err(|_| "caminho longo demais".to_owned())?;
        // SAFETY: `line` vive até o fim da chamada e `bytes` cobre o texto e o nulo final que o
        // HSTRING mantém no buffer.
        let status = unsafe { RegSetKeyValueW(HKEY_CURRENT_USER, RUN_KEY, VALUE, REG_SZ.0, Some(line.as_ptr().cast()), bytes) };
        if status != ERROR_SUCCESS {
            return Err(format!("não deu para ativar a inicialização com o Windows (erro {})", status.0));
        }
    } else {
        // SAFETY: só ponteiros para literais estáticos.
        let status = unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, RUN_KEY, VALUE) };
        if status != ERROR_SUCCESS && status != ERROR_FILE_NOT_FOUND {
            return Err(format!("não deu para desativar a inicialização com o Windows (erro {})", status.0));
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn set(_enabled: bool) -> Result<(), String> {
    Ok(())
}
