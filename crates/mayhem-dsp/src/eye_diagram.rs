//! Eye diagram computation for protocol analysis.
pub struct EyeDiagram { pub width: usize, pub height: usize, pub density: Vec<u32> }

pub fn compute_eye(samples: &[f32], samples_per_symbol: usize, height: usize) -> EyeDiagram {
    let width = samples_per_symbol * 2;
    let mut density = vec![0u32; width * height];
    for chunk in samples.chunks(width) {
        if chunk.len() < width { break; }
        for (x, &s) in chunk.iter().enumerate() {
            let y = ((s + 1.0) * 0.5 * (height - 1) as f32).clamp(0.0, (height-1) as f32) as usize;
            density[y * width + x] += 1;
        }
    }
    EyeDiagram { width, height, density }
}
