import { SettingsSection } from "./SettingsSection";
import { useConfig } from "../hooks/useConfig";
import type { ConfigValues } from "../types";

interface SettingsFormProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function SettingsForm({ onError, onSuccess }: SettingsFormProps) {
  const { schema, config, loading, saveSection } = useConfig();

  if (loading) {
    return (
      <section>
        <h2>Settings</h2>
        <div className="section-body">
          <p>Loading...</p>
        </div>
      </section>
    );
  }

  if (!schema || !config) {
    return null;
  }

  const handleSave = async (values: ConfigValues) => {
    await saveSection(values);
  };

  return (
    <>
      {schema.sections.map((section, idx) => (
        <SettingsSection
          key={idx}
          section={section}
          config={config}
          onSave={handleSave}
          onError={onError}
          onSuccess={onSuccess}
        />
      ))}
    </>
  );
}
