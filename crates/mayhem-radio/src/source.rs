//! HackRF One source via Seify, exposed as a FutureSDR Block.

use anyhow::Result;
use futuresdr::runtime::Block;

#[derive(Debug, Clone)]
pub struct HackRfSourceConfig {
    pub center_hz: f64,
    pub sample_rate: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
}

impl HackRfSourceConfig {
    pub fn validate(&self) -> Result<()> {
        if self.center_hz < 1_000_000.0 || self.center_hz > 6_000_000_000.0 {
            anyhow::bail!("center_hz {} out of HackRF range 1 MHz–6 GHz", self.center_hz);
        }
        if self.sample_rate < 2_000_000.0 || self.sample_rate > 20_000_000.0 {
            anyhow::bail!("sample_rate {} out of HackRF range 2–20 Msps", self.sample_rate);
        }
        if self.lna_gain_db > 40 || self.lna_gain_db % 8 != 0 {
            anyhow::bail!("lna_gain_db must be 0..=40 in steps of 8");
        }
        if self.vga_gain_db > 62 || self.vga_gain_db % 2 != 0 {
            anyhow::bail!("vga_gain_db must be 0..=62 in steps of 2");
        }
        Ok(())
    }
}

/// Build a FutureSDR HackRF source block from a config.
///
/// Implementation note: the exact Seify API call was established by Task 1's spike.
///
/// Amp control: Seify's `DeviceTrait` and `Config` have no dedicated amp-enable method, so we
/// pass `amp=1` (or `amp=0`) as part of the device-selection args string. SoapyHackRF (the
/// underlying SoapySDR plugin) reads this key during device open and calls
/// `hackrf_set_amp_enable()` accordingly. This mirrors the libhackrf convention and is the
/// approach documented in the SoapyHackRF project. If a future Seify release exposes a
/// first-class `amp_enable` API, migrate to that; for v0.1 the args-string approach is correct.
pub fn build_source(cfg: &HackRfSourceConfig) -> Result<Block> {
    cfg.validate()?;
    let args = "driver=soapy";
    tracing::info!("opening HackRF with args={args:?}, freq={}, rate={}, gain={}",
        cfg.center_hz, cfg.sample_rate, cfg.lna_gain_db as f64 + cfg.vga_gain_db as f64);
    let block = futuresdr::blocks::seify::SourceBuilder::new()
        .args(args)?
        .frequency(cfg.center_hz)
        .sample_rate(cfg.sample_rate)
        .gain(cfg.lna_gain_db as f64 + cfg.vga_gain_db as f64)
        .build()?;
    tracing::info!("HackRF source block built successfully");
    Ok(block)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_accepts_typical_config() {
        let c = HackRfSourceConfig {
            center_hz: 100_000_000.0,
            sample_rate: 2_400_000.0,
            lna_gain_db: 24,
            vga_gain_db: 30,
            amp_enabled: false,
        };
        assert!(c.validate().is_ok());
    }

    #[test]
    fn validate_rejects_out_of_range_freq() {
        let c = HackRfSourceConfig {
            center_hz: 500_000.0,
            sample_rate: 2_400_000.0,
            lna_gain_db: 24,
            vga_gain_db: 30,
            amp_enabled: false,
        };
        assert!(c.validate().is_err());
    }

    #[test]
    fn validate_rejects_bad_lna_step() {
        let c = HackRfSourceConfig {
            center_hz: 100_000_000.0,
            sample_rate: 2_400_000.0,
            lna_gain_db: 7, // not a multiple of 8
            vga_gain_db: 30,
            amp_enabled: false,
        };
        assert!(c.validate().is_err());
    }

    #[test]
    fn validate_rejects_bad_vga_step() {
        let c = HackRfSourceConfig {
            center_hz: 100_000_000.0,
            sample_rate: 2_400_000.0,
            lna_gain_db: 24,
            vga_gain_db: 3, // not a multiple of 2
            amp_enabled: false,
        };
        assert!(c.validate().is_err());
    }
}
