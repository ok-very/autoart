import { useState, useEffect } from "react";
import type { SchemaField } from "../types";

interface SettingsFieldProps {
  field: SchemaField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  dependsOnValue?: boolean;
}

export function SettingsField({ field, value, onChange, dependsOnValue }: SettingsFieldProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: unknown) => {
    setLocalValue(newValue);
    onChange(field.key, newValue);
  };

  // Handle depends_on visibility
  if (field.depends_on && !dependsOnValue) {
    return null;
  }

  if (field.type === "bool") {
    return (
      <div className="toggle">
        <input
          type="checkbox"
          id={`cfg-${field.key}`}
          checked={!!localValue}
          onChange={(e) => handleChange(e.target.checked)}
        />
        <label htmlFor={`cfg-${field.key}`}>{field.label}</label>
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={`cfg-${field.key}`}>{field.label}</label>
      {renderInput()}
    </div>
  );

  function renderInput() {
    switch (field.type) {
      case "int":
        return (
          <input
            type="number"
            id={`cfg-${field.key}`}
            value={localValue as number ?? field.default ?? ""}
            onChange={(e) => handleChange(parseInt(e.target.value, 10))}
            min={field.min}
            max={field.max}
          />
        );

      case "select":
        return (
          <select
            id={`cfg-${field.key}`}
            value={(localValue as string) ?? field.default ?? ""}
            onChange={(e) => handleChange(e.target.value)}
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "string_list":
        return (
          <textarea
            id={`cfg-${field.key}`}
            rows={3}
            value={
              Array.isArray(localValue)
                ? (localValue as string[]).join("\n")
                : (localValue as string) || ""
            }
            onChange={(e) => {
              const lines = e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean);
              handleChange(lines);
            }}
            placeholder={field.placeholder}
          />
        );

      case "tag_list":
        return (
          <input
            type="text"
            id={`cfg-${field.key}`}
            value={
              Array.isArray(localValue)
                ? (localValue as string[]).join(", ")
                : (localValue as string) || ""
            }
            onChange={(e) => {
              const tags = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              handleChange(tags);
            }}
            placeholder={field.placeholder}
          />
        );

      case "text":
        return (
          <textarea
            id={`cfg-${field.key}`}
            rows={4}
            value={(localValue as string) ?? field.default ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );

      default:
        // "string"
        return (
          <input
            type="text"
            id={`cfg-${field.key}`}
            value={(localValue as string) ?? field.default ?? ""}
            onChange={(e) => handleChange(e.target.value.trim())}
            placeholder={field.placeholder}
          />
        );
    }
  }
}
