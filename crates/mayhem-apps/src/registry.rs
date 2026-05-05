//! AppRegistry — static list of all apps. Looking up an app yields a factory closure.

use crate::App;
use mayhem_ipc::{AppId, AppMetadata};

type AppFactory = Box<dyn Fn() -> Box<dyn App> + Send + Sync>;

pub struct AppRegistry {
    apps: Vec<(AppMetadata, AppFactory)>,
}

impl AppRegistry {
    pub fn new() -> Self {
        Self { apps: Vec::new() }
    }

    pub fn register<A>(&mut self, metadata: AppMetadata, factory: impl Fn() -> A + Send + Sync + 'static)
    where
        A: App + 'static,
    {
        let f: AppFactory = Box::new(move || Box::new(factory()));
        self.apps.push((metadata, f));
    }

    pub fn list(&self) -> Vec<AppMetadata> {
        self.apps.iter().map(|(m, _)| m.clone()).collect()
    }

    pub fn instantiate(&self, id: AppId) -> Option<Box<dyn App>> {
        self.apps.iter().find(|(m, _)| m.id == id).map(|(_, f)| f())
    }
}

impl Default for AppRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::App;
    use mayhem_ipc::{AppMetadata, Direction, RegulatoryClass};

    struct DummyApp;
    impl App for DummyApp {
        fn metadata() -> AppMetadata where Self: Sized {
            AppMetadata {
                id: AppId::NfmAudio,
                name: "Dummy".into(),
                direction: Direction::Rx,
                regulatory_class: RegulatoryClass::Passive,
            }
        }
        fn start(&self, _params: serde_json::Value) -> anyhow::Result<crate::RunningApp> {
            unimplemented!()
        }
    }

    #[test]
    fn registry_lists_registered_apps() {
        let mut r = AppRegistry::new();
        r.register(DummyApp::metadata(), || DummyApp);
        let list = r.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Dummy");
    }

    #[test]
    fn registry_can_instantiate() {
        let mut r = AppRegistry::new();
        r.register(DummyApp::metadata(), || DummyApp);
        let app = r.instantiate(AppId::NfmAudio);
        assert!(app.is_some());
    }
}
