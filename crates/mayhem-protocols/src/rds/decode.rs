use super::group::RdsGroup;

#[derive(Debug, Clone)]
pub struct RdsStation {
    pub pi: u16,
    pub ps: [u8; 8],
    pub ps_valid: u8,      // bitmask of segments received (4 segments)
    pub rt: [u8; 64],
    pub rt_valid: u16,     // bitmask of segments received (16 segments)
    pub pty: u8,
    pub tp: bool,
}

impl Default for RdsStation {
    fn default() -> Self {
        Self {
            pi: 0,
            ps: [0u8; 8],
            ps_valid: 0,
            rt: [0u8; 64],
            rt_valid: 0,
            pty: 0,
            tp: false,
        }
    }
}

impl RdsStation {
    pub fn new() -> Self { Self::default() }

    pub fn process_group(&mut self, group: &RdsGroup) {
        self.pi = group.block_a;
        self.pty = group.pty();
        self.tp = group.tp();

        match group.group_type() {
            0 => self.decode_type_0(group),
            2 => self.decode_type_2(group),
            _ => {}
        }
    }

    fn decode_type_0(&mut self, group: &RdsGroup) {
        // PS name: 2 chars per group in block D
        let seg = (group.block_b & 0x03) as usize;
        self.ps[seg * 2] = (group.block_d >> 8) as u8;
        self.ps[seg * 2 + 1] = (group.block_d & 0xFF) as u8;
        self.ps_valid |= 1 << seg;
    }

    fn decode_type_2(&mut self, group: &RdsGroup) {
        // Radio Text: 4 chars per group (type 2A) in blocks C + D
        let seg = (group.block_b & 0x0F) as usize;
        let base = seg * 4;
        if base + 3 < 64 {
            self.rt[base] = (group.block_c >> 8) as u8;
            self.rt[base + 1] = (group.block_c & 0xFF) as u8;
            self.rt[base + 2] = (group.block_d >> 8) as u8;
            self.rt[base + 3] = (group.block_d & 0xFF) as u8;
            self.rt_valid |= 1 << seg;
        }
    }

    pub fn ps_string(&self) -> String {
        self.ps.iter()
            .map(|&b| if b.is_ascii_graphic() || b == b' ' { b as char } else { ' ' })
            .collect::<String>().trim_end().to_string()
    }

    pub fn rt_string(&self) -> String {
        let end = self.rt.iter().position(|&b| b == 0x0D).unwrap_or(64);
        self.rt[..end].iter()
            .map(|&b| if b.is_ascii_graphic() || b == b' ' { b as char } else { ' ' })
            .collect::<String>().trim_end().to_string()
    }
}
