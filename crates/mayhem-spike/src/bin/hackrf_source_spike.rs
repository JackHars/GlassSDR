//! Validate FutureSDR's Seify-based HackRF source can stream continuously @ 2.4 Msps for 30 min
//! without sample drops. If this fails, reconsider FutureSDR for the project.
//!
//! # API adjustments vs. the implementation plan
//!
//! The plan's pseudocode was close but had several details wrong for FutureSDR 0.0.36.
//! Corrections made, each with reasoning:
//!
//! | Plan | Actual 0.0.36 | Reason |
//! |------|--------------|--------|
//! | `use futuresdr::prelude::*` | explicit `futuresdr::runtime` + `futuresdr::macros` imports | No `prelude` module in 0.0.36 |
//! | `SourceBuilder::new().args("driver=hackrf")?` then `.build()?` | same — this was correct | Plan's SourceBuilder API matches source.rs |
//! | `futuresdr::blocks::seify::SourceBuilder` | same path — re-exported from source.rs | Path was correct |
//! | `#[tokio::main] async fn main()` | `fn main()` (sync) | FutureSDR uses smol/async-io, not tokio |
//! | `rt.start(fg).await` | `rt.start_sync(fg)` (no `.await`, no `?`) | start_sync returns tuple, not Result |
//! | `connect!(fg, src > sink > null)` | same — no port specifier needed | Single-channel Seify source uses default "out" port |
//! | `Builder::new("driver=hackrf")?` (first attempt) | `SourceBuilder::new().args("driver=hackrf")?` | Builder::new() takes BuilderType enum, not args string |
//! | `connect!(fg, src.outputs[0] > ...)` (first attempt) | `connect!(fg, src > ...)` | `[0]` indexing is not valid connect! macro syntax |
//! | `async_io::block_on(handle.terminate_and_wait())?` | same, explicit `let _: Result<()>` | type annotation needed for inference |
//!
//! The `seify` feature must be enabled in the workspace Cargo.toml (done).
//! FutureSDR runtime::init() must be called before start_sync().

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Result;
use futuresdr::async_io;
use futuresdr::blocks::seify::SourceBuilder;
use futuresdr::blocks::{Apply, NullSink};
use futuresdr::macros::connect;
use futuresdr::runtime::{Flowgraph, Runtime};
use num_complex::Complex32;
use tracing::info;

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let target_rate: f64 = 2_400_000.0;
    let target_freq: f64 = 100_000_000.0;
    let duration = Duration::from_secs(30 * 60);

    let mut fg = Flowgraph::new();

    // Build HackRF RX source via Seify (SoapySDR-compatible driver string).
    // SourceBuilder::new() returns a Builder<GenericDevice> configured for RX.
    // .args() accepts a string that becomes seify::Args (device filter).
    let src = SourceBuilder::new()
        .args("driver=hackrf")?
        .frequency(target_freq)
        .sample_rate(target_rate)
        .gain(40.0)
        .build()?;

    // Counter sink that records cumulative sample throughput.
    let counter = Arc::new(AtomicU64::new(0));
    let c2 = counter.clone();
    let sink = Apply::<_, _, _>::new(move |x: &Complex32| -> Complex32 {
        c2.fetch_add(1, Ordering::Relaxed);
        *x
    });
    let null = NullSink::<Complex32>::new();

    // Single-channel Seify source uses the default "out" port — no port qualifier needed.
    connect!(fg, src > sink > null);

    let rt = Runtime::new();
    // start_sync returns (TaskHandle, FlowgraphHandle) — not a Result, no ? needed.
    let (task, mut handle) = rt.start_sync(fg);

    let start = Instant::now();
    let mut last_count = 0u64;
    let mut last_check = Instant::now();

    while start.elapsed() < duration {
        std::thread::sleep(Duration::from_secs(5));
        let now = Instant::now();
        let count = counter.load(Ordering::Relaxed);
        let elapsed = now.duration_since(last_check).as_secs_f64();
        let rate = (count - last_count) as f64 / elapsed;
        let drift_pct = (rate - target_rate) / target_rate * 100.0;
        info!(
            "elapsed={:?} samples={} window_rate={:.0}sps drift={:.2}%",
            start.elapsed(),
            count,
            rate,
            drift_pct
        );
        last_count = count;
        last_check = now;
    }

    // Explicit type annotation resolves inference for the async error type.
    let _: Result<()> = async_io::block_on(handle.terminate_and_wait());
    drop(task);
    Ok(())
}
