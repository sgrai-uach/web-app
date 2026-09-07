import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGRAI — App Terreno",
  description:
    "Aplicación de terreno (PWA) del Sistema de Gestión de Recursos para Atención de Incidentes, Municipalidad de Valdivia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
