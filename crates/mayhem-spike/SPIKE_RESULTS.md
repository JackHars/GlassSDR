# Spike results

## hackrf-source-spike

- Date run: <fill in>
- HackRF firmware: <output of hackrf_info>
- FutureSDR version: 0.0.36
- Duration: 30 min
- Sample rate: 2.4 Msps
- Average measured rate: <fill in>
- Drift: <fill in>
- Underruns observed: <fill in>
- Decision: PASS / FAIL — keep FutureSDR vs fall back to direct hackrf crate

## tauri-ipc-spike

- Date run: <fill in>
- Tauri version: <fill in from Cargo.lock>
- Duration: 5 min
- Spectrum count expected: 9000 (±5%); actual: <fill in>; gaps: <fill in>
- Audio count expected: 15000 (±5%); actual: <fill in>; gaps: <fill in>
- Decision: PASS / FAIL — keep Tauri events vs fall back to localhost WebSocket
