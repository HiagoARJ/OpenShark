// Teclas como o firmware espera: usos HID (página 0x07). Botões do mouse dentro de macros usam
// 0xF1..0xF5.

const CODE_TO_HID: Record<string, number> = {
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c, Minus: 0x2d, Equal: 0x2e,
  BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
  Insert: 0x49, Home: 0x4a, PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e, ArrowRight: 0x4f,
  ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52, NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55,
  NumpadSubtract: 0x56, NumpadAdd: 0x57, NumpadEnter: 0x58, Numpad0: 0x62, NumpadDecimal: 0x63,
  IntlBackslash: 0x64, ContextMenu: 0x65, IntlRo: 0x87, NumpadComma: 0x85,
  ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
  ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
};

for (let i = 0; i < 26; i++) CODE_TO_HID["Key" + String.fromCharCode(65 + i)] = 0x04 + i;
for (let i = 1; i <= 9; i++) CODE_TO_HID["Digit" + i] = 0x1d + i;
CODE_TO_HID.Digit0 = 0x27;
for (let i = 1; i <= 12; i++) CODE_TO_HID["F" + i] = 0x39 + i;
for (let i = 1; i <= 9; i++) CODE_TO_HID["Numpad" + i] = 0x58 + i;

const NAMES: Record<number, string> = {
  0x28: "Enter", 0x29: "Esc", 0x2a: "Backspace", 0x2b: "Tab", 0x2c: "Espaço", 0x2d: "-", 0x2e: "=",
  0x2f: "[", 0x30: "]", 0x31: "\\", 0x33: ";", 0x34: "'", 0x35: "`", 0x36: ",", 0x37: ".", 0x38: "/",
  0x39: "Caps Lock", 0x46: "Print Screen", 0x47: "Scroll Lock", 0x48: "Pause", 0x49: "Insert", 0x4a: "Home",
  0x4b: "Page Up", 0x4c: "Delete", 0x4d: "End", 0x4e: "Page Down", 0x4f: "→", 0x50: "←", 0x51: "↓", 0x52: "↑",
  0x53: "Num Lock", 0x54: "Num /", 0x55: "Num *", 0x56: "Num -", 0x57: "Num +", 0x58: "Num Enter",
  0x62: "Num 0", 0x63: "Num .", 0x64: "\\ (ABNT)", 0x65: "Menu", 0x87: "/ (ABNT)", 0x85: "Num ,",
  0xe0: "Ctrl esq.", 0xe1: "Shift esq.", 0xe2: "Alt esq.", 0xe3: "Win esq.",
  0xe4: "Ctrl dir.", 0xe5: "Shift dir.", 0xe6: "Alt Gr", 0xe7: "Win dir.",
  0xf1: "Botão esquerdo", 0xf2: "Botão direito", 0xf3: "Botão do meio", 0xf4: "Botão voltar", 0xf5: "Botão avançar",
};
for (let i = 0; i < 26; i++) NAMES[0x04 + i] = String.fromCharCode(65 + i);
for (let i = 1; i <= 9; i++) NAMES[0x1d + i] = String(i);
NAMES[0x27] = "0";
for (let i = 1; i <= 12; i++) NAMES[0x39 + i] = "F" + i;
for (let i = 1; i <= 9; i++) NAMES[0x58 + i] = "Num " + i;

export function hidFromCode(code: string): number | null {
  return CODE_TO_HID[code] ?? null;
}

export function keyName(hid: number): string {
  return NAMES[hid] ?? `0x${hid.toString(16).padStart(2, "0")}`;
}

/// Botões do mouse (`MouseEvent.button`) → código de macro.
export function hidFromMouse(button: number): number | null {
  return ({ 0: 0xf1, 2: 0xf2, 1: 0xf3, 3: 0xf4, 4: 0xf5 } as Record<number, number>)[button] ?? null;
}

export const MOD_CTRL = 1;
export const MOD_SHIFT = 2;
export const MOD_ALT = 4;
export const MOD_WIN = 8;

export function shortcutLabel(modifiers: number, key: number): string {
  const parts: string[] = [];
  if (modifiers & MOD_CTRL) parts.push("Ctrl");
  if (modifiers & MOD_SHIFT) parts.push("Shift");
  if (modifiers & MOD_ALT) parts.push("Alt");
  if (modifiers & MOD_WIN) parts.push("Win");
  if (key) parts.push(keyName(key));
  return parts.join(" + ") || "—";
}

export function isModifier(hid: number) {
  return hid >= 0xe0 && hid <= 0xe7;
}
