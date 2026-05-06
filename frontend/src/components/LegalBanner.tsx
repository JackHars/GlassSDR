import { acceptTxLegal } from "../ipc/commands";
import { useStore } from "../store";

const LEGAL_TEXT = `Transmitting requires a valid amateur radio license and must occur only on frequencies allocated for amateur use. Transmitting on commercial paging frequencies is illegal. By proceeding, you confirm you hold an appropriate license and will transmit only on authorized frequencies.`;

export function LegalBanner({ onAccept }: { onAccept: () => void }) {
  const setLegalAccepted = useStore((s) => s.setLegalAccepted);

  const handleAccept = async () => {
    await acceptTxLegal();
    setLegalAccepted(true);
    onAccept();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1c1c2c", border: "2px solid #f44", borderRadius: 8, padding: 24, maxWidth: 500 }}>
        <h2 style={{ color: "#f44", margin: "0 0 16px" }}>Regulatory Notice</h2>
        <p style={{ color: "#ccc", lineHeight: 1.5 }}>{LEGAL_TEXT}</p>
        <button onClick={handleAccept} style={{ marginTop: 16, padding: "10px 20px", background: "#f44", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
          I Acknowledge — I Hold a Valid License
        </button>
      </div>
    </div>
  );
}
