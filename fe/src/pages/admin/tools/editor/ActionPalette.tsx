import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Typography } from "antd";
import { HolderOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import {
  PALETTE_TYPES,
  paletteDragId,
  type PaletteType,
} from "../../../../types/automation";

export function ActionPalette({
  selectedType,
  onSelectType,
  onAdd,
}: {
  selectedType: PaletteType;
  onSelectType: (type: PaletteType) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Typography.Paragraph type="secondary" className="mb-2 text-sm">
        {t("automationTools.dragHint")}
      </Typography.Paragraph>
      {PALETTE_TYPES.map((type) => (
        <PaletteItem
          key={type}
          type={type}
          selected={selectedType === type}
          onClick={() => {
            onSelectType(type);
            onAdd();
          }}
        />
      ))}
    </div>
  );
}

function PaletteItem({
  type,
  selected,
  onClick,
}: {
  type: PaletteType;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: paletteDragId(type),
      data: { type: "palette", paletteType: type },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex cursor-grab items-center gap-2 rounded border px-3 py-2 text-sm active:cursor-grabbing ${
        selected
          ? "border-blue-400 bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <HolderOutlined className="text-slate-400" />
      <span>{t(`automationTools.stepTypes.${type}`)}</span>
    </div>
  );
}
