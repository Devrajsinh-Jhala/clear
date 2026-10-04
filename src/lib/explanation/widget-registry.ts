import { INTERACTIVE_WIDGET_TYPES, type InteractiveWidgetSpec } from "@/src/lib/explanation/schema";

const rendered = new Set<string>(INTERACTIVE_WIDGET_TYPES);

export function canRenderInteractive(widget: InteractiveWidgetSpec): boolean {
  return rendered.has(widget.type);
}
