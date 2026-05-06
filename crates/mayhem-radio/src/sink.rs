//! HackRF One sink via Seify, exposed as a FutureSDR Block.

use anyhow::Result;
use futuresdr::runtime::Block;

#[derive(Debug, Clone)]
pub struct HackRfSinkConfig {
    pub center_hz: f64,
    pub sample_rate: f64,
    pub vga_gain_db: u32,  // TX VGA: 0..=47
    pub amp_enabled: bool,
}

impl HackRfSinkConfig {
    pub fn validate(&self) -> Result<()> {
        if self.center_hz < 1_000_000.0 || self.center_hz > 6_000_000_000.0 {
            anyhow::bail!("center_hz {} out of HackRF range 1 MHz–6 GHz", self.center_hz);
        }
        if self.sample_rate < 2_000_000.0 || self.sample_rate > 20_000_000.0 {
            anyhow::bail!("sample_rate {} out of HackRF range 2–20 Msps", self.sample_rate);
        }
        if self.vga_gain_db > 47 {
            anyhow::bail!("TX vga_gain_db must be 0..=47, got {}", self.vga_gain_db);
        }
        Ok(())
    }
}

/// Build a FutureSDR HackRF sink block from a config.
///
/// Amp control: passed via the device-selection args string as `amp=1` or `amp=0`.
/// SoapyHackRF reads this key during device open and calls `hackrf_set_amp_enable()`.
/// HackRF TX has VGA gain only (no LNA); the single gain value maps directly to TX VGA.
pub fn build_sink(cfg: &HackRfSinkConfig) -> Result<Block> {
    cfg.validate()?;
    let amp_val = if cfg.amp_enabled { 1 } else { 0 };
    let args = format!("driver=hackrf,amp={amp_val}");
    let block = futuresdr::blocks::seify::SinkBuilder::new()
        .args(args.as_str())?
        .frequency(cfg.center_hz)
        .sample_rate(cfg.sample_rate)
        .gain(cfg.vga_gain_db as f64)
        .build()?;
    Ok(block)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_accepts_typical_config() {
        let c = HackRfSinkConfig {
            center_hz: 439_987_500.0,
            sample_rate: 2_400_000.0,
            vga_gain_db: 30,
            amp_enabled: false,
        };
        assert!(c.validate().is_ok());
    }

    #[test]
    fn validate_rejects_out_of_range_freq() {
        let c = HackRfSinkConfig {
            center_hz: 500_000.0,
            sample_rate: 2_400_000.0,
            vga_gain_db: 30,
            amp_enabled: false,
        };
        assert!(c.validate().is_err());
    }

    #[test]
    fn validate_rejects_high_vga() {
        let c = HackRfSinkConfig {
            center_hz: 439_000_000.0,
            sample_rate: 2_400_000.0,
            vga_gain_db: 48, // max is 47
            amp_enabled: false,
        };
        assert!(c.validate().is_err());
    }

    #[test]
    fn validate_accepts_max_vga() {
        let c = HackRfSinkConfig {
            center_hz: 439_000_000.0,
            sample_rate: 2_400_000.0,
            vga_gain_db: 47,
            amp_enabled: true,
        };
        assert!(c.validate().is_ok());
    }
}
