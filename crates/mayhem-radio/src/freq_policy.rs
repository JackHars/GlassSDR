//! TX frequency lockout — denies protected bands.

const DENIED_BANDS: &[(f64, f64, &str)] = &[
    (108e6, 137e6, "VHF aviation"),
    (225e6, 380e6, "UHF military"),
    (960e6, 1215e6, "DME/TACAN"),
    (121.5e6, 121.5e6 + 1.0, "emergency"),
    (156.8e6, 156.8e6 + 1.0, "maritime Ch16"),
    (406e6, 406.1e6, "EPIRB"),
    (698e6, 960e6, "cellular"),
    (1710e6, 2200e6, "cellular PCS"),
    (929e6, 932e6, "commercial paging"),
];

const APP_EXCEPTIONS: &[(&str, f64, f64)] = &[
    ("adsb_tx", 1090e6, 1090e6 + 1.0),
    ("gps_sim", 1575.42e6, 1575.42e6 + 1.0),
];

pub struct FrequencyPolicy;

impl FrequencyPolicy {
    pub fn check(app_id: &str, freq_hz: f64) -> Result<(), String> {
        for &(app, low, high) in APP_EXCEPTIONS {
            if app == app_id && freq_hz >= low && freq_hz <= high {
                return Ok(());
            }
        }
        for &(low, high, reason) in DENIED_BANDS {
            if freq_hz >= low && freq_hz <= high {
                return Err(format!(
                    "TX denied at {:.3} MHz: {}",
                    freq_hz / 1e6,
                    reason
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denies_aviation() {
        assert!(FrequencyPolicy::check("replay", 121.5e6).is_err());
    }

    #[test]
    fn allows_amateur() {
        assert!(FrequencyPolicy::check("any", 144.39e6).is_ok());
    }

    #[test]
    fn allows_adsb_exception() {
        assert!(FrequencyPolicy::check("adsb_tx", 1090e6).is_ok());
    }
}
