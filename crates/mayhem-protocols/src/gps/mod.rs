//! GPS L1 C/A signal generation (stub — full implementation deferred).

pub fn generate_ca_code(prn: u8) -> [i8; 1023] {
    let mut code = [1i8; 1023];
    // Simplified: alternating ±1 (real Gold code generation deferred)
    for i in 0..1023 {
        code[i] = if (i + prn as usize) % 2 == 0 { 1 } else { -1 };
    }
    code
}
