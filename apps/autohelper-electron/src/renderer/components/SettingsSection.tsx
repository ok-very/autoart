import { useState, useMemo } from "react";
import { SettingsField } from "./SettingsField";
import type { SchemaSection, ConfigValues } from "../types";

interface SettingsSectionProps {
  section: SchemaSection;
  config: ConfigValues;
  onSave: (values: ConfigValues) => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function SettingsSection({ section, config, onSave, onError, onSuccess }: SettingsSectionProps) {
  const [values, setValues] = useState<ConfigValues>(() => {
    const initial: ConfigValues = {};
    for (const field of section.fields) {
      initial[field.key] = config[field.key] ?? field.default;
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);

  // Track dependency values for depends_on
  const dependencyValues = useMemo(() => {
    const deps: Record<string, boolean> = {};
    for (const field of section.fields) {
      if (field.type === "bool") {
        deps[field.key] = !!values[field.key];
      }
    }
    return deps;
  }, [section.fields, values]);

  const handleFieldChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(values);
      onSuccess(`${section.label} saved`);
    } catch (e) {
      onError(`Failed to save ${section.label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  // Group fields by row_group
  const fieldGroups: Array<{ isRow: boolean; fields: typeof section.fields }> = [];
  const processed = new Set<string>();

  for (const field of section.fields) {
    if (processed.has(field.key)) continue;

    if (field.row_group) {
      const group = section.fields.filter((f) => f.row_group === field.row_group);
      fieldGroups.push({ isRow: true, fields: group });
      group.forEach((f) => processed.add(f.key));
    } else {
      fieldGroups.push({ isRow: false, fields: [field] });
      processed.add(field.key);
    }
  }

  return (
    <section className={section.admin_only ? "admin-only" : ""}>
      <h2>
        {section.label}
        {section.admin_only && <span className="admin-badge">Admin</span>}
      </h2>
      <div className="section-body">
        {fieldGroups.map((group, idx) => {
          if (group.isRow) {
            return (
              <div key={idx} className="field-row">
                {group.fields.map((field) => (
                  <SettingsField
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    onChange={handleFieldChange}
                    dependsOnValue={field.depends_on ? dependencyValues[field.depends_on] : true}
                  />
                ))}
              </div>
            );
          }

          const field = group.fields[0];
          return (
            <SettingsField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={handleFieldChange}
              dependsOnValue={field.depends_on ? dependencyValues[field.depends_on] : true}
            />
          );
        })}

        <div className="button-row">
          <button onClick={handleSave} disabled={saving} className="primary">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
