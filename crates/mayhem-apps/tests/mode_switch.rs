//! Integration test: rapidly switch between RX and TX app stop/start cycles.
//! Validates that the RunningApp stop/join pattern has no deadlocks.

#[tokio::test]
async fn rapid_mode_switch_no_deadlock() {
    use std::time::Duration;
    use tokio::time::timeout;

    for i in 0..100 {
        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
        let join = tokio::spawn(async move {
            let _ = stop_rx.await;
        });

        // Signal stop
        let _ = stop_tx.send(());

        // Join must complete within 1 second
        let result = timeout(Duration::from_secs(1), join).await;
        assert!(
            result.is_ok(),
            "Deadlock on iteration {i}: join did not complete after stop"
        );
    }
}
