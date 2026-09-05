import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  renderBodegiaDashboard,
  renderDemoLogin,
} from "../src/demo/mvp-demo.js";
import { resourceState } from "../src/features/dashboard/operational-dashboard-state.js";
import { renderSurfaceState } from "../src/features/dashboard/surface-state-view.js";

describe("web accessibility semantics [T056]", () => {
  it("names navigation and retains a single current destination without positive tabindex", () => {
    const html = renderBodegiaDashboard("owner_admin");
    expect(html).toContain('<nav aria-label="Navegacion principal">');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).not.toMatch(/tabindex="[1-9]/);
    expect(html).toContain("<main");
  });

  it("keeps login controls labeled in DOM order with an announced error", () => {
    const html = renderDemoLogin();
    expect(html.indexOf('id="demo-username"')).toBeLessThan(
      html.indexOf('id="demo-pin"'),
    );
    expect(html.indexOf('id="demo-pin"')).toBeLessThan(
      html.indexOf('id="enter-dashboard"'),
    );
    expect(html).toMatch(/<label>Usuario demo<input/);
    expect(html).toMatch(/<label>PIN demo<input/);
    expect(html).toMatch(/id="login-error"[^>]*role="alert"/);
  });

  it("names and keyboard-enables every wide-table region and associates column headers", () => {
    const html = renderBodegiaDashboard("owner_admin");
    const regions = [...html.matchAll(/<div class="table-wrap"[^>]*>/g)].map(
      (match) => match[0],
    );
    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      expect(region).toContain('role="region"');
      expect(region).toMatch(/aria-label="[^"]+"/);
      expect(region).toContain('tabindex="0"');
    }
    expect(html).not.toContain("<th>");
    expect(html).toContain('<th scope="col">');
  });

  it("announces loading, empty, stale and errors without making entire data tables live", () => {
    const render = (state: ReturnType<typeof resourceState.ready<string[]>>) =>
      renderSurfaceState({
        resource: "products",
        label: "Productos",
        state,
        canRetry: true,
        renderContent: () => "<table></table>",
      });
    expect(render(resourceState.loading(1))).toContain('role="status"');
    expect(render(resourceState.empty("today", 1))).toContain('role="status"');
    expect(render(resourceState.stale([], "FAILED", null, 2))).toContain(
      'role="status"',
    );
    const error = render(resourceState.error("private", "corr-1", 2));
    expect(error).toMatch(/role="alert"[^>]*>[^<]*corr-1/);
    expect(render(resourceState.ready([], "today", 2))).not.toContain(
      'aria-live="assertive"',
    );
  });

  it("defines visible focus, reduced motion and AA text contrast for status colors", () => {
    const html = readFileSync("apps/web/demo/index.html", "utf8");
    expect(html).toContain(":focus-visible");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toMatch(/overflow-x:\s*hidden/);
    const luminance = (hex: string): number => {
      const channels = [0, 2, 4]
        .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        );
      return (
        channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      );
    };
    for (const [name, background] of [
      ["warning", "fff3d7"],
      ["danger", "fae8e8"],
      ["ok", "e4f4eb"],
      ["muted", "f8fafb"],
    ]) {
      const foreground = html.match(
        new RegExp(`--${name}: #([a-f0-9]{6})`),
      )?.[1];
      expect(foreground).toBeDefined();
      expect(
        (luminance(background!) + 0.05) / (luminance(foreground!) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
