import { expect, test } from "@playwright/test";

const webUrl = "http://localhost:5173";

const roles = [
  {
    query: "owner_admin",
    radio: /Dueño administrador/u,
    username: "propietario",
    pin: "100001",
    links: [
      "Inicio",
      "Configuracion de bodega",
      "Empleados y roles",
      "Ventas rapidas",
      "Operacion OLTP",
      "Data Warehouse",
      "BI/OLAP",
    ],
  },
  {
    query: "inventory_manager",
    radio: /Encargado de inventario/u,
    username: "inventario",
    pin: "100002",
    links: ["Inicio", "Ventas rapidas", "Operacion OLTP"],
  },
  {
    query: "seller",
    radio: /Vendedor/u,
    username: "vendedor",
    pin: "100003",
    links: ["Inicio", "Ventas rapidas"],
  },
] as const;

for (const role of roles) {
  test(`renders the effective capability navigation for ${role.query} [T063]`, async ({
    page,
  }) => {
    await page.goto(webUrl);
    await page.getByRole("radio", { name: role.radio }).check();
    await page.locator("#demo-username").fill(role.username);
    await page.locator("#demo-pin").fill(role.pin);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const navigation = page.getByRole("navigation", {
      name: "Navegacion principal",
    });
    await expect(navigation.getByRole("link")).toHaveText(role.links);
    await expect(navigation.locator('[aria-current="page"]')).toHaveText(
      "Inicio",
    );
    await expect(page.getByText("Roadmap", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Permisos", { exact: true })).toHaveCount(0);
  });
}

test("rebuilds context and rejects an unauthorized deep link after a role change [T063]", async ({
  page,
}) => {
  await page.goto(`${webUrl}/#warehouse`);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("link", { name: "Data Warehouse" }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByRole("radio", { name: /Vendedor/u }).check();
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  const navigation = page.getByRole("navigation", {
    name: "Navegacion principal",
  });
  await expect(navigation.getByRole("link")).toHaveText([
    "Inicio",
    "Ventas rapidas",
  ]);
  await expect(page).toHaveURL(/#inicio$/u);
  await expect(
    page.locator("#warehouse, #bi, #oltp, #configuracion, #empleados"),
  ).toHaveCount(0);
});
