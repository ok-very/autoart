import { ServiceStatus } from "./components/ServiceStatus";
import { SettingsForm } from "./components/SettingsForm";
import { ContactSync } from "./components/ContactSync";
import { Pairing } from "./components/Pairing";
import { Toast } from "./components/Toast";
import { useToast } from "./hooks/useToast";
import { useConfig } from "./hooks/useConfig";

export function App() {
  const { toasts, success, error } = useToast();
  const { config, saveSection } = useConfig();

  return (
    <>
      <div className="dashboard">
        <h1>AutoHelper</h1>
        <p className="subtitle">Local service configuration</p>

        <ServiceStatus />
        <SettingsForm onError={error} onSuccess={success} />
        <ContactSync onError={error} onSuccess={success} />
        <Pairing config={config} onConfigUpdate={saveSection} onError={error} onSuccess={success} />
      </div>

      <Toast toasts={toasts} />
    </>
  );
}
