import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { TuningControls } from "../../components/TuningControls";
import { AudioSink } from "../../components/AudioSink";
import { startNfm, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
const DEFAULT_TUNING = {
    center_hz: 162_550_000.0, // NOAA weather radio is a reliable test target
    lna_gain_db: 24,
    vga_gain_db: 30,
    amp_enabled: false,
    squelch_db: -80,
};
export function NfmAudioApp() {
    const [spec, setSpec] = useState(null);
    const [audio, setAudio] = useState(null);
    const status = useStore((s) => s.status);
    const setStatus = useStore((s) => s.setStatus);
    const running = status.kind === "running" || status.kind === "starting";
    useEffect(() => {
        const u1 = onSpectrum(setSpec);
        const u2 = onAudio(setAudio);
        const u3 = onAppStatus(setStatus);
        return () => {
            u1.then((f) => f());
            u2.then((f) => f());
            u3.then((f) => f());
        };
    }, [setStatus]);
    const onApply = async (t) => {
        if (running)
            await stopApp();
        await startNfm(t);
    };
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [_jsx(TuningControls, { initial: DEFAULT_TUNING, onApply: onApply, running: running }), _jsx(Waterfall, { width: 1024, height: 300, frame: spec }), _jsx(AudioSink, { frame: audio }), _jsx("button", { onClick: () => stopApp(), disabled: !running, children: "Stop" }), _jsx("pre", { style: { color: "#888" }, children: JSON.stringify(status, null, 2) })] }));
}
