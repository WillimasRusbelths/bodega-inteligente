import type { ResourceState } from "./operational-dashboard-state.js";

export function escapeSurfaceText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Only trusted labels and correlation metadata are rendered, never raw server errors. */
export function renderSurfaceState<T>(input: {
  readonly resource: string;
  readonly label: string;
  readonly state: ResourceState<T>;
  readonly renderContent: (data: T) => string;
  readonly canRetry?: boolean;
}): string {
  const { state } = input;
  const label = escapeSurfaceText(input.label.toLowerCase());
  const pending =
    state.status === "stale" && state.reason === "POST_SALE_REFRESH_PENDING";
  const retry =
    input.canRetry === true && !pending
      ? `<button type="button" data-retry-resource="${escapeSurfaceText(input.resource)}">Reintentar actualización de ${label}</button>`
      : "";
  let content: string;
  switch (state.status) {
    case "idle":
      content = `<p role="status">${escapeSurfaceText(input.label)} pendiente de consulta.</p>`;
      break;
    case "loading":
      content = `<p role="status">Cargando ${label}…</p>`;
      break;
    case "empty":
      content = `<p>No hay ${label} para la consulta actual.</p>`;
      break;
    case "error":
      content = `<p role="alert">No se pudieron cargar ${label}. Los datos anteriores no se muestran porque pueden estar desactualizados.</p><p data-correlation-id="${escapeSurfaceText(state.correlationId ?? "")}">correlationId: ${escapeSurfaceText(state.correlationId ?? "no disponible")}</p>${retry}`;
      break;
    case "stale":
      content = `<p role="status">${pending ? "Actualizando" : "Datos no sincronizados de"} ${label}. Los datos pueden estar desactualizados.</p>${state.correlationId === null ? "" : `<p>correlationId: ${escapeSurfaceText(state.correlationId)}</p>`}${state.receivedAt === undefined ? "" : `<p>Última lectura recibida: <time>${escapeSurfaceText(state.receivedAt)}</time></p>`}${input.renderContent(state.data)}${retry}`;
      break;
    case "ready":
      content = input.renderContent(state.data);
      break;
  }
  return `<div data-resource="${escapeSurfaceText(input.resource)}" data-state="${state.status}"${state.status === "loading" || pending ? ' aria-busy="true"' : ""}>${content}</div>`;
}
