import { Checkbox, Form, Input, InputNumber, Select } from "antd";
import { useTranslation } from "react-i18next";

import type { ActionStep } from "../../../../types/automation";

export function StepFields({
  step,
  onChange,
}: {
  step: ActionStep;
  onChange: (next: ActionStep) => void;
}) {
  const { t } = useTranslation();

  switch (step.type) {
    case "goto":
      return (
        <Form.Item label={t("automationTools.url")} required className="mb-0">
          <Input
            value={step.url}
            onChange={(e) => onChange({ ...step, url: e.target.value })}
            placeholder="https://example.com"
          />
        </Form.Item>
      );
    case "click":
    case "waitFor":
      return (
        <>
          <Form.Item label={t("automationTools.xpath")} required className="mb-2">
            <Input.TextArea
              rows={2}
              value={step.xpath}
              onChange={(e) => onChange({ ...step, xpath: e.target.value })}
              placeholder="//button[@id='submit']"
            />
          </Form.Item>
          <Form.Item label={t("automationTools.timeoutMs")} className="mb-0">
            <InputNumber
              min={100}
              max={120000}
              className="w-full"
              value={step.timeoutMs ?? 30000}
              onChange={(v) => onChange({ ...step, timeoutMs: v ?? undefined })}
            />
          </Form.Item>
        </>
      );
    case "input":
      return (
        <>
          <Form.Item label={t("automationTools.xpath")} required className="mb-2">
            <Input.TextArea
              rows={2}
              value={step.xpath}
              onChange={(e) => onChange({ ...step, xpath: e.target.value })}
            />
          </Form.Item>
          <Form.Item label={t("automationTools.text")} required className="mb-2">
            <Input
              value={step.text}
              onChange={(e) => onChange({ ...step, text: e.target.value })}
            />
          </Form.Item>
          <Form.Item className="mb-0">
            <Checkbox
              checked={step.clearFirst ?? false}
              onChange={(e) => onChange({ ...step, clearFirst: e.target.checked })}
            >
              {t("automationTools.clearFirst")}
            </Checkbox>
          </Form.Item>
        </>
      );
    case "wait":
      return (
        <Form.Item label={t("automationTools.waitMs")} required className="mb-0">
          <InputNumber
            min={0}
            max={300000}
            className="w-full"
            value={step.ms}
            onChange={(v) => onChange({ ...step, ms: v ?? 0 })}
          />
        </Form.Item>
      );
    case "scroll":
      return (
        <>
          <Form.Item label={t("automationTools.xpathOptional")} className="mb-2">
            <Input.TextArea
              rows={2}
              value={step.xpath ?? ""}
              onChange={(e) =>
                onChange({ ...step, xpath: e.target.value || undefined })
              }
            />
          </Form.Item>
          <Form.Item label={t("automationTools.deltaY")} className="mb-0">
            <InputNumber
              className="w-full"
              value={step.deltaY ?? 300}
              onChange={(v) => onChange({ ...step, deltaY: v ?? undefined })}
            />
          </Form.Item>
        </>
      );
    case "press":
      return (
        <Form.Item label={t("automationTools.key")} required className="mb-0">
          <Select
            value={step.key}
            onChange={(key) => onChange({ ...step, key })}
            options={[
              "Enter",
              "Tab",
              "Escape",
              "ArrowDown",
              "ArrowUp",
              "Backspace",
            ].map((k) => ({ label: k, value: k }))}
          />
        </Form.Item>
      );
    default:
      return null;
  }
}
